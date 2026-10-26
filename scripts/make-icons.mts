// Usage: npx tsx scripts/make-icons.mts [source.svg|source.png]
// Renders the app icons into public/icons/ from one source image (default: public/icons/icon.svg).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "icons");
const source = path.resolve(process.argv[2] ?? path.join(outDir, "icon.svg"));
const BG = "#FFC72C";

await mkdir(outDir, { recursive: true });

const render = (size: number) => sharp(source, { density: 384 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

// "any" icons: the source as-is.
await render(192).png().toFile(path.join(outDir, "icon-192.png"));
await render(512).png().toFile(path.join(outDir, "icon-512.png"));

// Maskable: full-bleed background, artwork shrunk into the central 80% safe zone.
const inner = Math.round(512 * 0.7);
const art = await sharp(source, { density: 384 }).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: art, gravity: "centre" }])
  .png()
  .toFile(path.join(outDir, "icon-maskable-512.png"));

// iOS rounds the corners itself and dislikes transparency: opaque square.
await render(180).flatten({ background: BG }).png().toFile(path.join(outDir, "apple-touch-icon.png"));

console.log("icons written to", outDir);
