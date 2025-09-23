// src/app/page.tsx
export const dynamic = "force-dynamic"; // 👈 fuerza render dinámico (sin cache)

import styles from "./page.module.css";
import Hero from "./components/Hero/Hero";
import Featured from "./components/Featured/Featured"; // ⬅️ NUEVO

export default function Home() {
  return (
    <main>
      <Hero />

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

      {/* ⬇️ Reemplazo del placeholder por la grilla real de destacados */}
      <Featured />
    </main>
  );
}

