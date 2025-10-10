export const dynamic = "force-dynamic";

import styles from "./page.module.css";
import Hero from "./components/Hero/Hero";
import Featured from "./components/Featured/Featured";
import Footer from "./components/Footer/Footer"; // ⬅️ NUEVO

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

      <Featured />

      {/* ⬇️ Footer nuevo */}
      <Footer />
    </main>
  );
}
