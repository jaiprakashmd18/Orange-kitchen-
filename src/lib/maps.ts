/**
 * Accepts whatever the owner pastes from Google Maps "Share → Embed a map":
 * the full <iframe …> code or just its src link. Returns a safe embed URL or
 * throws with a friendly message. Only Google Maps embed URLs are allowed,
 * because the value is rendered inside an <iframe> on the site.
 */
export function parseMapsEmbed(input: string | null): string | null {
  if (!input) return null;
  let raw = input.trim();
  const src = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  if (src) raw = src[1];
  else if (/<iframe/i.test(raw)) {
    const loose = raw.match(/src\s*=\s*["']?([^"'\s>]+)/i);
    if (loose) raw = loose[1];
  }
  raw = raw.replace(/&amp;/g, "&");
  let u: URL;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error("Paste the code from Google Maps → Share → Embed a map.");
  }
  const okHost = /(^|\.)google\.[a-z.]+$/.test(u.hostname);
  if (!okHost || !u.pathname.startsWith("/maps/embed")) {
    throw new Error("That isn't a Google Maps embed code. In Google Maps open your restaurant → Share → Embed a map → Copy HTML, and paste it here.");
  }
  u.protocol = "https:";
  return u.toString();
}

/** Google Maps share/place link (maps.app.goo.gl, goo.gl/maps, google.com/maps). Also accepts a pasted iframe. */
export function parseMapsLink(input: string | null): string | null {
  if (!input) return null;
  let raw = input.trim();
  const src = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  if (src) raw = src[1].replace(/&amp;/g, "&");
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("Paste the link from Google Maps → Share → Copy link.");
  }
  const h = u.hostname;
  const ok = h === "maps.app.goo.gl" || h === "goo.gl" || /(^|\.)google\.[a-z.]+$/.test(h);
  if (!ok) throw new Error("That isn't a Google Maps link. In Google Maps open your restaurant → Share → Copy link.");
  u.protocol = "https:";
  return u.toString();
}
