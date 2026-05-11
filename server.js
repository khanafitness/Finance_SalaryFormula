import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Launch Puppeteer ──────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
}

// ── Render HTML template → PDF bytes ─────────────────────────
async function renderToPdf(browser, templatePath, data) {
  const raw = fs.readFileSync(templatePath, "utf8");
  const html = raw
    .replace(/\{\{CUSTOMER_NAME\}\}/g, data.customer_name || "")
    .replace(/\{\{EMAIL\}\}/g,         data.email         || "")
    .replace(/\{\{MOBILE_NO\}\}/g,     data.mobile_number || "");

  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

// ── /generate-pdf ─────────────────────────────────────────────
app.post("/generate-pdf", async (req, res) => {
  let browser;
  try {
    const data = req.body;
    if (!data.customer_name || !data.email || !data.mobile_number) {
      return res.status(400).json({ error: "Missing required fields: customer_name, email, mobile_number" });
    }
    console.log("Generating PDF for:", data.customer_name);

    const templatePath = path.join(__dirname, "templates", "salary_formula_template.html");
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: "Template not found: salary_formula_template.html" });
    }

    browser = await launchBrowser();
    const pdfBytes = await renderToPdf(browser, templatePath, data);
    console.log("PDF generated:", pdfBytes.length, "bytes");

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="The-Salary-Formula-${data.customer_name.replace(/\s+/g, "-")}.pdf"`,
    });
    res.send(pdfBytes);
  } catch (err) {
    console.error("generate-pdf error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "";

app.listen(PORT, () => {
  console.log(`Salary Formula PDF server running on port ${PORT}`);
  if (RENDER_URL) {
    setInterval(async () => {
      try {
        const res = await fetch(`${RENDER_URL}/health`);
        console.log("Keep-alive ping:", res.status);
      } catch (err) {
        console.warn("Keep-alive ping failed:", err.message);
      }
    }, 10 * 60 * 1000);
  }
});
