// Génère les icônes de l'app à partir du logo « la pousse ».
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const leaves = `
  <path d="M100 160 Q102.6 100.9 50 74 Q47.4 133.1 100 160 Z" fill="#84CC16"/>
  <path d="M100 160 Q161.7 123.5 156 52 Q94.3 88.5 100 160 Z" fill="#10B981"/>`;
const square = (viewBox, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1024" height="1024">
  <rect x="-1000" y="-1000" width="3000" height="3000" fill="#0F172A"${rounded ? '' : ''}/>${leaves}</svg>`;

const normal = square('-26 -24 260 260');
const maskable = square('-56 -54 320 320');
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -24 260 260"><rect x="-26" y="-24" width="260" height="260" rx="58" fill="#0F172A"/>${leaves}</svg>`;

writeFileSync('public/icons/favicon.svg', favicon);
await sharp(Buffer.from(normal)).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
await sharp(Buffer.from(normal)).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(normal)).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png');
console.log('icônes générées');
