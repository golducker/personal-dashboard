// Generates placeholder mascot art (512x512, transparent). Replace public/mascots/*.webp with the real cut-outs.
import sharp from "sharp";

const psyduck = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <ellipse cx="256" cy="330" rx="150" ry="150" fill="#FFC72C"/>
  <ellipse cx="256" cy="205" rx="130" ry="118" fill="#FFD04D"/>
  <path d="M255 70 q-18 -40 -34 -14 M262 72 q8 -44 30 -20 M270 78 q22 -34 36 -6" stroke="#2A1F0A" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="256" cy="255" rx="96" ry="52" fill="#F4D9A6"/>
  <circle cx="212" cy="255" r="7" fill="#9A6A00"/><circle cx="300" cy="255" r="7" fill="#9A6A00"/>
  <circle cx="205" cy="190" r="34" fill="#fff"/><circle cx="307" cy="190" r="34" fill="#fff"/>
  <circle cx="208" cy="192" r="6" fill="#2A1F0A"/><circle cx="304" cy="192" r="6" fill="#2A1F0A"/>
  <ellipse cx="150" cy="340" rx="34" ry="52" fill="#FFB800" transform="rotate(18 150 340)"/>
  <ellipse cx="362" cy="340" rx="34" ry="52" fill="#FFB800" transform="rotate(-18 362 340)"/>
  <ellipse cx="205" cy="476" rx="52" ry="22" fill="#F4D9A6"/><ellipse cx="307" cy="476" rx="52" ry="22" fill="#F4D9A6"/>
</svg>`;

const gengar = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <path d="M120 60 L186 150 L220 96 L256 150 L292 96 L326 150 L392 60 L384 200 L440 290 L400 330 L420 440 L330 470 L256 482 L182 470 L92 440 L112 330 L72 290 L128 200 Z" fill="#6B3FD0"/>
  <path d="M96 300 L40 262 L84 360 Z M416 300 L472 262 L428 360 Z" fill="#5A32B4"/>
  <path d="M150 290 q106 -48 212 0" stroke="#E2457A" stroke-width="0" fill="none"/>
  <path d="M150 292 Q256 410 362 292 Q256 336 150 292 Z" fill="#fff"/>
  <path d="M170 296 Q256 392 342 296" fill="#E2457A" opacity=".85"/>
  <path d="M138 214 L228 244 L226 196 Z" fill="#fff"/><path d="M374 214 L284 244 L286 196 Z" fill="#fff"/>
  <path d="M158 218 L216 238 L215 208 Z" fill="#E2457A"/><path d="M354 218 L296 238 L297 208 Z" fill="#E2457A"/>
  <ellipse cx="256" cy="496" rx="120" ry="12" fill="#000" opacity="0"/>
</svg>`;

await sharp(Buffer.from(psyduck)).webp({ quality: 88 }).toFile("public/mascots/psyduck.webp");
await sharp(Buffer.from(gengar)).webp({ quality: 88 }).toFile("public/mascots/gengar.webp");
console.log("ok");
