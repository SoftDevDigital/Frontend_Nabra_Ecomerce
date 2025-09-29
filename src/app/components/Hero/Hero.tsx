// src/app/components/Hero/Hero.tsx
import type { CSSProperties } from "react";
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
  // ✅ Siempre hay un fondo por defecto desde /public
  const localCoverUrl = "/zapateria.jpeg";

  // ⬅️ por defecto 3001 (backend)
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  let remoteCoverUrl: string | null = null;
  let remoteUpdatedAt: string | number | undefined;

  // 1) preferido
  const a = await getJSON(`${base}/media/cover-image/active`);
  if (a?.data?.url) {
    remoteCoverUrl = a.data.url as string;
    remoteUpdatedAt = a.data.updatedAt;
  }

  // 2) fallback
  if (!remoteCoverUrl) {
    const b = await getJSON(`${base}/media?type=cover&active=true`);
    const arr = Array.isArray(b?.data) ? (b!.data as MediaDoc[]) : [];
    const found = arr.find(x => x.active && x.type === "cover") ?? null;
    if (found?.url) {
      remoteCoverUrl = found.url;
      remoteUpdatedAt = found.updatedAt;
    }
  }

  // 3) último intento
  if (!remoteCoverUrl) {
    const c = await getJSON(`${base}/media/cover-image`);
    const arr = Array.isArray(c?.data) ? (c!.data as MediaDoc[]) : [];
    const found = arr.find(x => x.active) ?? null;
    if (found?.url) {
      remoteCoverUrl = found.url;
      remoteUpdatedAt = found.updatedAt;
    }
  }

  // Normalizo URL remota si existe (soporta absolutas y relativas)
  let finalCoverUrl = localCoverUrl; // 👈 por defecto, tu imagen local
  if (remoteCoverUrl) {
    const isAbsolute = /^https?:\/\//i.test(remoteCoverUrl);
    const ver = remoteUpdatedAt ?? Date.now();
    const raw = isAbsolute ? remoteCoverUrl : `${base}/${remoteCoverUrl}`;
    finalCoverUrl = `${raw}?v=${encodeURIComponent(ver)}`.replace(/([^:]\/)\/+/g, "$1");
  }

  const styleVar = { ["--hero-bg" as any]: `url(${finalCoverUrl})` } as CSSProperties;

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
