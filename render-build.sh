#!/usr/bin/env bash

# exit on error
set -o errexit

# Install dependencies
npm install

# Ensure the Puppeteer cache directory exists
PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

# Install Chrome
npx puppeteer browsers install chrome

# Store/restore Puppeteer cache
if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
  echo "...Copying Puppeteer Cache from Build Cache"
  cp -R /opt/render/project/src/.cache/puppeteer/chrome/ $PUPPETEER_CACHE_DIR
else
  echo "...Storing Puppeteer Cache in Build Cache"
  cp -R $PUPPETEER_CACHE_DIR /opt/render/project/src/.cache/puppeteer/chrome/
fi
