// Generates PWA / favicon icons.
//   node scripts/generate-icons.mjs path/to/orange-kitchen-logo.png [#background]
// With a logo file, icons are cut from the restaurant's real logo on a
// white/orange background. Without one, a neutral placeholder (a plain bowl
// glyph — not a logo) is produced; replace it before launch.
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const out = path.resolve("public/icons");
mkdirSync(out, { recursive: true });
const logo = process.argv[2];
const BG = process.argv[3] || "#ffffff"; // optional background colour, e.g. "#FFFAEE"
if (logo && !existsSync(logo)) {
  console.error(`Logo not found: ${logo}`);
  process.exit(1);
}

const placeholder = (size, pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#F26B1D"/>
  <g transform="translate(${pad} ${pad}) scale(${(64 - pad * 2) / 64})" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
    <ellipse cx="32" cy="36" rx="22" ry="7"/>
    <path d="M10 36c0 9 9.8 15 22 15s22-6 22-15"/>
    <path d="M25 24c0-4 4-4 4-8m6 8c0-4 4-4 4-8"/>
  </g>
</svg>`);

async function make(file, size, { maskable = false, bg = BG } = {}) {
  const pad = maskable ? Math.round(size * 0.2) : Math.round(size * 0.08);
  let img;
  if (logo) {
    const inner = await sharp(logo).resize(size - pad * 2, size - pad * 2, { fit: "contain", background: bg }).png().toBuffer();
    img = sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: inner, gravity: "center" }]);
  } else {
    img = sharp(placeholder(size, maskable ? 12 : 6));
  }
  await img.resize(size, size).png().toFile(path.join(out, file));
  console.log("wrote", file);
}

await make("icon-192.png", 192);
await make("icon-512.png", 512);
await make("icon-maskable-512.png", 512, { maskable: true });
await make("apple-touch-icon.png", 180);
await make("favicon-32.png", 32);
console.log(logo ? "Icons generated from your logo." : "Placeholder icons generated — run again with your logo file before launch.");
