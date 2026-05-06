/* global __dirname */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const sourceDir = path.join(assetsDir, 'images');
const darkBackground = '#0F1115';

const outputs = {
  icon: path.join(assetsDir, 'icon.png'),
  adaptiveIcon: path.join(assetsDir, 'adaptive-icon.png'),
  splash: path.join(assetsDir, 'splash.png'),
};

function source(name) {
  const file = path.join(sourceDir, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing source mascot asset: ${file}`);
  }
  return file;
}

async function squareAsset(input, output, size, padding) {
  const mascotSize = size - padding * 2;
  const mascot = await sharp(input)
    .resize(mascotSize, mascotSize, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: darkBackground,
    },
  })
    .composite([{ input: mascot, gravity: 'center' }])
    .png()
    .toFile(output);
}

async function splashAsset(input, output) {
  const width = 1284;
  const height = 2778;
  const mascot = await sharp(input)
    .resize(720, 720, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: darkBackground,
    },
  })
    .composite([{ input: mascot, top: 820, left: Math.round((width - 720) / 2) }])
    .png()
    .toFile(output);
}

async function main() {
  await squareAsset(source('neuro-calm.png'), outputs.icon, 1024, 104);
  await squareAsset(source('neuro-calm.png'), outputs.adaptiveIcon, 1024, 136);
  await splashAsset(source('neuro-happy.png'), outputs.splash);
  console.log('[assets] generated icon.png, adaptive-icon.png, splash.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
