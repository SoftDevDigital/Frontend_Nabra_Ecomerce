import type { Metadata } from "next";
import styles from "./page.module.css";
import HeroOptimized from "./components/Hero/HeroOptimized";
import LazyFeatured from "./components/Lazy/LazyFeatured";
import Footer from "./components/Footer/Footer";
// import StructuredData from "./components/SEO/StructuredData";
// import { generateMetadata, generateStructuredData } from "@/lib/seo";

const HOME_SEO = {
  title: "NABRA | Calzado de Calidad para la Mujer Moderna",
  description: "Descubre nuestra colección de calzado elegante y cómodo. Zapatos que enamoran, pasos que inspiran. Envío gratis en compras mayores a $500.",
  keywords: [
    "zapatos mujer",
    "calzado elegante", 
    "zapatos cómodos",
    "moda femenina",
    "zapatos online",
    "NABRA",
    "calzado de calidad",
    "zapatos trendy",
    "zapatos México",
    "calzado premium"
  ],
  image: "/zapateria.jpeg",
  url: "/",
  type: "website" as const,
};

// export const metadata: Metadata = generateMetadata(HOME_SEO);

export default function Home() {
  return (
    <main>
      <HeroOptimized />

      {/* Franja tipo marquee */}
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.track}>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i}>
              ¡Estilo versátil para la mujer moderna!&nbsp;&nbsp;•&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      <LazyFeatured />

      {/* ⬇️ Footer nuevo */}
      <Footer />
    </main>
  );
}
