// src/app/components/Hero/Hero.tsx
import styles from "./Hero.module.css";
import Link from "next/link";

type MediaDoc = {
  _id: string;
  url: string;
  type: "product" | "cover";
  active: boolean;
  updatedAt?: string;
};

async function getJSON(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) return null;
    return json;
  } catch {
    return null;
  }
}

export default async function Hero() {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
  let cover: MediaDoc | null = null;

  // 1) Endpoint preferido: /media/cover-image/active
  const a = await getJSON(`${base}/media/cover-image/active`);
  if (a?.data?.url) {
    cover = a.data as MediaDoc;
  }

  // 2) Fallback: /media?type=cover&active=true  (lista -> tomo la primera)
  if (!cover) {
    const b = await getJSON(`${base}/media?type=cover&active=true`);
    const arr = Array.isArray(b?.data) ? (b!.data as MediaDoc[]) : [];
    cover = arr.find(x => x.active && x.type === "cover") ?? null;
  }

  // 3) Último intento: /media/cover-image (lista) -> busco active:true
  if (!cover) {
    const c = await getJSON(`${base}/media/cover-image`);
    const arr = Array.isArray(c?.data) ? (c!.data as MediaDoc[]) : [];
    cover = arr.find(x => x.active) ?? null;
  }

  if (!cover?.url) return null;

  const ver = cover.updatedAt ?? Date.now();
  const coverUrl = `${base}/${cover.url}?v=${encodeURIComponent(ver)}`.replace(
    /([^:]\/)\/+/g,
    "$1"
  );

  const styleVar = { ["--hero-bg"]: `url(${coverUrl})` } as React.CSSProperties;

  return (
    <section className={styles.hero} aria-label="Hero principal" style={styleVar}>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>
          PASOS QUE INSPIRAN,<br /> ZAPATOS QUE ENAMORAN
        </h1>
        <Link href="/catalogo" className={styles.cta} aria-label="Ver productos">
          VER PRODUCTOS
        </Link>
      </div>
    </section>
  );
}
