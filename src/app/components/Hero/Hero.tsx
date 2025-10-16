import type { CSSProperties } from "react";
import styles from "./Hero.module.css";
import Link from "next/link";
import OptimizedImage from "../UI/OptimizedImage";

async function getJSON(url: string) {
  try {
    const res = await fetch(url, { 
      cache: "force-cache",
      next: { revalidate: 300 } // 5 minutos
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) return null;
    return json;
  } catch {
    return null;
  }
}

export default async function Hero() {
  // 🚀 OPTIMIZACIÓN: Usar imagen local por defecto para carga inmediata
  const localFallback = "/zapateria.jpeg";
  
  // Siempre usar la imagen local primero para carga inmediata
  const styleVar = {
    ["--hero-bg" as any]: `url(${localFallback})`,
  } as CSSProperties;

  // Intentar cargar imagen remota en background (opcional)
  let remoteCoverUrl: string | null = null;
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

  try {
    // Solo intentar fetch si la API está disponible
    const resp = await getJSON(`${base}/media/cover-image/active/url`);
    if (resp) {
      const data = (resp as any).data ?? resp;
      remoteCoverUrl = typeof data === "string" ? data : data?.url ?? null;
    }
  } catch {
    // Si falla, usar imagen local (ya está configurada)
  }

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
