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
        

        {/* 2) Línea divisoria */}
        <hr className={styles.hr} />

        {/* 3) Créditos + Social */}
        <section className={styles.bottomRow}>
          <div className={styles.legal}>
            © {new Date().getFullYear()} Nabra. Todos los derechos reservados.
            <span className={styles.dot}>•</span>
            <Link href="/terminos" className={styles.link}>
              Términos y políticas
            </Link>
          </div>

          <div className={styles.social}>
            <Link
              href="https://www.instagram.com/nabra.mx"
              target="_blank"
              className={styles.icon}
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="17.5" cy="6.5" r="1.2" />
              </svg>
            </Link>
            <Link
              href="https://www.facebook.com/Nabramx/"
              target="_blank"
              className={styles.icon}
              aria-label="Facebook"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M14 8h2V5h-2a4 4 0 0 0-4 4v2H8v3h2v5h3v-5h2.2l.8-3H13V9a1 1 0 0 1 1-1Z"
                  fill="currentColor"
                />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </footer>
  );
}
