// src/lib/resolveImageUrls.ts
// ✅ cambiar default al 3001 para alinear con tu API
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://https://api.nabra.mx";

export type MediaDoc = {
  _id: string;
  url: string;
  mimeType: string;
  updatedAt?: string;
};

/* ✅ NUEVO: heurística para aceptar solo URLs que “parecen” imagen */
function isLikelyImageUrl(u: string) {
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) {
    if (/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u)) return true;
    if (/[?&](width|height|format|v)=/i.test(u) && !/\.html?($|\?)/i.test(u)) return true;
    return !/\.html?($|\?)/i.test(u) && !/\.php($|\?)/i.test(u);
  }
  // relativo: lo resolvemos y luego validamos afuera
  return true;
}

export async function resolveImageUrls(images: string[]): Promise<string[]> {
  const safe = images.filter(Boolean);
  const out: string[] = [];

  for (const raw of safe) {
    // Si ya es URL absoluta y parece imagen, úsala
    if (/^https?:\/\//i.test(raw)) {
      if (isLikelyImageUrl(raw)) out.push(raw);
      continue;
    }

    // Si parece ser un MongoID, lo tratamos como mediaId
    if (/^[a-f\d]{24}$/i.test(raw)) {
      try {
        const res = await fetch(`${API_BASE}/media/${raw}`, { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json?.success && json?.data?.url) {
          const ver = json?.data?.updatedAt ?? Date.now();
          const abs = `${API_BASE}/${json.data.url}?v=${encodeURIComponent(ver)}`.replace(/([^:]\/)\/+/g, "$1");
          if (isLikelyImageUrl(abs)) out.push(abs);
          continue;
        }
      } catch { /* ignore y caemos al siguiente caso */ }
    }

    // fallback: por si viniera ya como ruta relativa
    const rel = `${API_BASE}/${raw}`.replace(/([^:]\/)\/+/g, "$1");
    if (isLikelyImageUrl(rel)) out.push(rel);
  }

  return out;
}

