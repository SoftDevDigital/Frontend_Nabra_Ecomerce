import type { CSSProperties } from "react";
import styles from "./Hero.module.css";
import Link from "next/link";

async function getJSON(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) return null;
    return json;
  } catch {
    return null;
  }
}

export default async function Hero() {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

  const toAbs = (u?: string | null) =>
    u && /^https?:\/\//i.test(u) ? u : u ? `${base}/${u}`.replace(/([^:]\/)\/+/g, "$1") : "";

  let remoteCoverUrl: string | null = null;

  // 1) Portada activa (id + url)
  const resp = await getJSON(`${base}/media/cover-image/active/url`);
  if (resp) {
    const data = (resp as any).data ?? resp;
    remoteCoverUrl = typeof data === "string" ? data : data?.url ?? null;
  }

  // 2) Fallback suave
  if (!remoteCoverUrl) {
    const r = await getJSON(`${base}/media/cover-image/active`);
    if (r?.data?.url) remoteCoverUrl = r.data.url as string;
  }

  // ✅ cache-buster correcto aunque ya tenga ?
  const abs = remoteCoverUrl ? toAbs(remoteCoverUrl) : null;
  const chosen = abs ? `${abs}${abs.includes("?") ? "&" : "?"}v=${Date.now()}` : null;

  // Siempre seteamos la var: si no hay portada -> none
  const styleVar = {
    ["--hero-bg" as any]: chosen ? `url(${chosen})` : "none",
  } as CSSProperties;

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
