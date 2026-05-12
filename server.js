import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "10mb" }));

// ─── Health check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ─── Launch browser ───────────────────────────────────────────
async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

// ─── Render template to PDF ───────────────────────────────────
async function renderTemplateToPdf(browser, templatePath, data) {
  let html = fs.readFileSync(templatePath, "utf8");
  html = html
    .replace(/\{\{CUSTOMER_NAME\}\}/g, data.customer_name || "")
    .replace(/\{\{EMAIL\}\}/g,         data.email         || "")
    .replace(/\{\{MOBILE_NO\}\}/g,     data.mobile_number || "");

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" }
  });
  await page.close();
  return pdf;
}

// ─── Generate PDF ─────────────────────────────────────────────
app.post("/generate-pdf", async (req, res) => {
  let browser;
  try {
    const data = req.body;
    if (!data.customer_name || !data.email || !data.mobile_number) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const templatePath = path.join(__dirname, "templates", "salary_formula_template.html");
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: "Template not found" });
    }

    console.log("Generating PDF for:", data.customer_name);
    browser = await launchBrowser();
    const pdf = await renderTemplateToPdf(browser, templatePath, data);
    console.log("PDF generated:", pdf.length, "bytes");

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="The-Salary-Formula-${data.customer_name.replace(/\s+/g, "-")}.pdf"`
    });
    res.send(pdf);
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
  console.log("Salary Formula PDF server running on port", PORT);
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
