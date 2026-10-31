// Pure helpers for automatic dish photos (unit-tested; no server imports).

export interface PhotoCandidate {
  source: "pexels" | "wikimedia" | "pixabay";
  thumb: string; // small preview
  full: string; // ~1000px image to copy into our storage
  credit: string;
  creditUrl: string;
  width: number;
  height: number;
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Search phrases for a dish, most specific first. */
export function photoQueries(dish: string, category?: string | null) {
  const name = dish.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const qs = [`${name} south indian food`, `${name} dish`, name];
  if (category && !name.toLowerCase().includes(category.toLowerCase())) qs.push(`${category} ${name}`);
  return [...new Set(qs)];
}

type PexelsResponse = {
  photos?: { width: number; height: number; url: string; photographer: string; src: { medium: string; large: string } }[];
};

export function parsePexels(json: PexelsResponse): PhotoCandidate[] {
  return (json.photos ?? []).map((p) => ({
    source: "pexels",
    thumb: p.src.medium,
    full: p.src.large,
    credit: `Photo by ${p.photographer} on Pexels`,
    creditUrl: p.url,
    width: p.width,
    height: p.height,
  }));
}

type PixabayResponse = {
  hits?: { pageURL: string; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number; user: string }[];
};

export function parsePixabay(json: PixabayResponse): PhotoCandidate[] {
  return (json.hits ?? [])
    .filter((h) => h.largeImageURL && h.imageWidth >= 600)
    .map((h) => ({
      source: "pixabay" as const,
      thumb: h.webformatURL,
      full: h.largeImageURL,
      credit: `Image by ${h.user} on Pixabay`,
      creditUrl: h.pageURL,
      width: h.imageWidth,
      height: h.imageHeight,
    }));
}

export function pixabaySearchUrl(key: string, query: string) {
  return `https://pixabay.com/api/?${new URLSearchParams({ key, q: query.slice(0, 100), image_type: "photo", category: "food", orientation: "horizontal", safesearch: "true", per_page: "10" })}`;
}

type CommonsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        index?: number;
        imageinfo?: {
          mime: string;
          width: number;
          height: number;
          thumburl?: string;
          url: string;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string }>;
        }[];
      }
    >;
  };
};

const FREE_LICENSE = /^(cc[ -]by|cc0|public domain|pd)/i;

export function parseCommons(json: CommonsResponse): PhotoCandidate[] {
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: PhotoCandidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== "image/jpeg" || ii.width < 600 || ii.height < 400) continue;
    const ratio = ii.width / ii.height;
    if (ratio < 0.75 || ratio > 2.2) continue; // skip odd panoramas / tall strips
    const license = stripHtml(ii.extmetadata?.LicenseShortName?.value ?? "");
    if (!FREE_LICENSE.test(license)) continue;
    const artist = stripHtml(ii.extmetadata?.Artist?.value ?? "") || "Unknown author";
    out.push({
      source: "wikimedia",
      thumb: ii.thumburl ?? ii.url,
      full: ii.thumburl ?? ii.url,
      credit: `${artist.slice(0, 80)} · ${license} · Wikimedia Commons`,
      creditUrl: ii.descriptionurl,
      width: ii.width,
      height: ii.height,
    });
  }
  return out;
}

export function commonsSearchUrl(query: string, limit = 12, width = 1000) {
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrsearch: `${query} filetype:bitmap`,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: String(width),
    iiextmetadatafilter: "Artist|LicenseShortName",
  });
  return `https://commons.wikimedia.org/w/api.php?${q.toString()}`;
}
