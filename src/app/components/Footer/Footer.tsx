"use client";

import Link from "next/link";
import styles from "./Footer.module.css";
import { useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<null | "ok" | "err">(null);

  // Simulación local (reemplazá por tu API si luego querés persistir)
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSent("err");
      return;
    }
    setSent("ok");
    setEmail("");
  }

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.container}>
        {/* 1) Promoción / CTA */}
        <section className={styles.promoCard} aria-label="Promoción de bienvenida">
          <div className={styles.promoCopy}>
            <h3 className={styles.promoTitle}>
              Hey, Girl <span aria-hidden>💖</span>
            </h3>
            <p className={styles.promoText}>
              Registrate y obtené <b>10% OFF</b> en tu primera orden a partir de <b>$1499 MXN</b>.
            </p>
            <small className={styles.promoSmall}>
              Promoción aplicable únicamente en tu primera compra dentro de la tienda online.
            </small>
          </div>

          <div className={styles.promoCtas}>
            <Link href="/catalogo" className={`${styles.btn} ${styles.btnHollow}`}>
              VER MÁS MODELOS
            </Link>

            {/* Newsletter pill */}
            <form onSubmit={handleSubmit} className={styles.newsletter} aria-label="Newsletter">
              <input
                className={styles.input}
                type="email"
                placeholder="Dirección de correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Correo electrónico"
              />
              <button className={styles.send} aria-label="Suscribirme" title="Suscribirme">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M5 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </form>

            {sent === "ok" && <div className={styles.msgOk}>¡Gracias! Te avisaremos de nuevos modelos.</div>}
            {sent === "err" && <div className={styles.msgErr}>Ingresá un email válido.</div>}
          </div>
        </section>

        {/* 2) Línea divisoria */}
        <hr className={styles.hr} />

        {/* 3) Créditos + Social */}
        <section className={styles.bottomRow}>
          <div className={styles.legal}>
            © {new Date().getFullYear()} Nabra. Todos los derechos reservados.
            <span className={styles.dot}>•</span>
            <Link href="/terminos" className={styles.link}>Términos y políticas</Link>
          </div>

          <div className={styles.social}>
            <Link href="https://instagram.com" target="_blank" className={styles.icon} aria-label="Instagram">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="17.5" cy="6.5" r="1.2" />
              </svg>
            </Link>
            <Link href="https://facebook.com" target="_blank" className={styles.icon} aria-label="Facebook">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M14 8h2V5h-2a4 4 0 0 0-4 4v2H8v3h2v5h3v-5h2.2l.8-3H13V9a1 1 0 0 1 1-1Z" fill="currentColor" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </footer>
  );
}
