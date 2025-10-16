import type { CSSProperties } from "react";
import styles from "./Hero.module.css";
import Link from "next/link";
import Image from "next/image";

export default function HeroOptimized() {
  // 🚀 OPTIMIZACIÓN: Usar imagen local por defecto para carga inmediata
  const heroImage = "/zapateria.jpeg";
  
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

