/* global __dirname */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');

const expected = [
  { file: 'icon.png', width: 1024, height: 1024 },
  { file: 'adaptive-icon.png', width: 1024, height: 1024 },
  { file: 'splash.png', width: 1284, height: 2778 },
];

async function main() {
  for (const item of expected) {
    const file = path.join(assetsDir, item.file);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing generated asset: ${file}`);
    }
    const meta = await sharp(file).metadata();
    if (meta.width !== item.width || meta.height !== item.height) {
      throw new Error(
        `${item.file} must be ${item.width}x${item.height}; got ${meta.width}x${meta.height}`,
      );
    }
  }
  console.log('[assets] generated assets are present with expected dimensions');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
