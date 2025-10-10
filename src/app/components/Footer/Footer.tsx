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
            <Link
  href="https://wa.me/523312442370?text=Hola%20Nabra%2C%20quisiera%20hacer%20una%20consulta"
  target="_blank"
  className={`${styles.icon} ${styles.whatsapp}`}
  aria-label="WhatsApp"
  title="Chatear por WhatsApp"
>
  {/* Ícono WhatsApp */}
  <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19.1 17.5c-.3-.2-1.8-.9-2-.9s-.5-.1-.7.3-.8.9-.9 1-.3.2-.6.1a7.6 7.6 0 0 1-2.3-1.4 8.5 8.5 0 0 1-1.6-2c-.2-.4 0-.5.1-.6l.5-.6c.1-.2.2-.4.3-.6s0-.4 0-.6l-.8-2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.7 3.7 0 0 0-1.2 2.8 6.5 6.5 0 0 0 1.4 3.2 14.7 14.7 0 0 0 5.7 5 10.6 10.6 0 0 0 1.8.7 4.4 4.4 0 0 0 2 .1 3.2 3.2 0 0 0 2.1-1.4 2.6 2.6 0 0 0 .2-1.4c0-.1-.3-.2-.6-.4zM16 4a12 12 0 0 0-10.3 18l-1.6 5.8 5.9-1.6A12 12 0 1 0 16 4zm7 19.1a9.7 9.7 0 0 1-4.9 2.6 9.7 9.7 0 0 1-7.6-1.5l-.5-.3-3.5.9.9-3.4-.3-.5A9.7 9.7 0 1 1 23 23.1z"
    />
  </svg>
</Link>
          </div>
        </section>
      </div>
    </footer>
  );
}
