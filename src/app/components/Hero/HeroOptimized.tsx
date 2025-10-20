import type { CSSProperties } from "react";
import styles from "./Hero.module.css";
import Link from "next/link";
import Image from "next/image";

async function getCoverImageUrl(): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
    const response = await fetch(`${base}/media/cover/active`, { 
      cache: "force-cache",
      next: { revalidate: 300 } // 5 minutos
    });
    
    if (!response.ok) {
      throw new Error("No se pudo obtener la imagen de portada");
    }
    
    const data = await response.json();
    const url = data?.url || data?.data?.url;
    
    if (url && typeof url === "string") {
      return url;
    }
    
    throw new Error("URL de imagen no válida");
  } catch (error) {
    console.warn("Error al obtener imagen de portada, usando imagen por defecto:", error);
    return "/zapateria.jpeg"; // Fallback a imagen local
  }
}

export default async function HeroOptimized() {
  // 🚀 OPTIMIZACIÓN: Obtener imagen de portada dinámicamente
  const heroImage = await getCoverImageUrl();
  
  // Estilos con imagen de fallback inmediata
  const styleVar = {
    ["--hero-bg" as any]: `url(${heroImage})`,
  } as CSSProperties;

  return (
    <section className={styles.hero} aria-label="Hero principal" style={styleVar}>
      {/* Imagen de preload invisible para garantizar carga */}
      <Image 
        src={heroImage} 
        alt="NABRA - Calzado de calidad" 
        priority={true}
        fill
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: -2,
          objectFit: 'cover'
        }}
      />
      
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