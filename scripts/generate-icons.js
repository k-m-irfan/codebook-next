#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 * Run: npm install sharp --save-dev && node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Sharp not installed. Install it with: npm install sharp --save-dev');
    console.log('Then run this script again.');
    process.exit(1);
  }

  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const outputDir = path.join(__dirname, '../public/icons');

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: icon-${size}.png`);
  }

  // Generate favicon
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));
  console.log('Created: favicon.png');

  // Generate Apple touch icon
  await sharp(svgPath)
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));
  console.log('Created: apple-touch-icon.png');

  console.log('\nDone! All icons generated successfully.');
}

generateIcons().catch(console.error);
