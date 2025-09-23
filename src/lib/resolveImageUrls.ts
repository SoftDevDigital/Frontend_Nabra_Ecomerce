// src/lib/resolveImageUrls.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export type MediaDoc = {
  _id: string;
  url: string;
  mimeType: string;
  updatedAt?: string;
};

export async function resolveImageUrls(images: string[]): Promise<string[]> {
  const safe = images.filter(Boolean);
  const out: string[] = [];

  for (const raw of safe) {
    // Si ya es URL absoluta, úsala tal cual
    if (/^https?:\/\//i.test(raw)) {
      out.push(raw);
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
          out.push(abs);
          continue;
        }
      } catch { /* ignore y caemos al siguiente caso */ }
    }

    // fallback: por si viniera ya como ruta relativa
    out.push(`${API_BASE}/${raw}`.replace(/([^:]\/)\/+/g, "$1"));
  }

  return out;
}
