/**
 * Script para gerar ícones PNG do PWA usando sharp.
 * Execute: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';

const sizes = [192, 512];
const outDir = './public/icons';

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

for (const size of sizes) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.125)}" fill="#020617"/>
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#B8942A"/>
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.42}" fill="none" stroke="url(#g)" stroke-width="${Math.round(size*0.015)}" opacity="0.25"/>
  <polygon points="${size/2},${size*0.16} ${size*0.585},${size*0.38} ${size*0.82},${size*0.38} ${size*0.635},${size*0.52} ${size*0.7},${size*0.75} ${size/2},${size*0.615} ${size*0.3},${size*0.75} ${size*0.365},${size*0.52} ${size*0.18},${size*0.38} ${size*0.415},${size*0.38}" 
    fill="url(#g)" opacity="0.95"/>
  <text x="${size/2}" y="${size*0.94}" text-anchor="middle" fill="#D4AF37" font-family="Georgia,serif" font-size="${Math.round(size*0.085)}" font-weight="bold" letter-spacing="${Math.round(size*0.01)}">JOSÉ</text>
</svg>`);

  await sharp(svg).resize(size, size).png().toFile(`${outDir}/icon-${size}x${size}.png`);
  console.log(`✓ icon-${size}x${size}.png`);
}

console.log('Pronto!');
