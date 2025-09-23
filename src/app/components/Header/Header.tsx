// src/app/components/Header/Header.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AuthDialog from "../Auth/AuthDialog";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const [openAuth, setOpenAuth] = useState(false);

  return (
    <>
      <header className={styles.header} role="banner">
        <div className={styles.container}>
          {/* IZQ: logo + nav */}
          <div className={styles.left}>
            <Link href="/" className={styles.brand} aria-label="NABRA - Inicio">
              <Image src="/logoNabra.png" alt="NABRA" width={172} height={48} priority />
            </Link>

            <nav className={styles.nav} aria-label="Principal">
              <Link href="/" className={`${styles.link} ${isActive("/") ? styles.active : ""}`}>Inicio</Link>
              <Link href="/catalogo" className={`${styles.link} ${isActive("/catalogo") ? styles.active : ""}`}>Catálogo</Link>
              <Link href="/preventa" className={`${styles.link} ${isActive("/preventa") ? styles.active : ""}`}>Preventa</Link>
              <Link href="/contacto" className={`${styles.link} ${isActive("/contacto") ? styles.active : ""}`}>Contacto</Link>
            </nav>
          </div>

          {/* DERECHA: iconos */}
          <div className={styles.actions} aria-label="Acciones">
            {/* Buscar (Link) */}
            <Link
              href="/buscar"
              className={`${styles.iconBtn} ${styles.iconBtnSearch} ${styles.iconForce}`}
              aria-label="Buscar"
              title="Buscar productos"
              style={{ color: "#111" }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M20 20l-3.2-3.2" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </Link>

            {/* Cuenta (button que abre el diálogo) */}
            <button
              type="button"
              onClick={() => setOpenAuth(true)}
              className={`${styles.iconBtn} ${styles.iconForce}`}
              aria-label="Cuenta"
              title="Mi cuenta"
              style={{ color: "#111" }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                {/* ← grosor + stroke explícitos */}
                <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {/* Carrito */}
            <Link
              href="/carrito"
              className={`${styles.iconBtn} ${styles.iconForce}`}
              aria-label="Carrito"
              title="Carrito"
              style={{ color: "#111" }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M6.5 8h11l-1 11H7.5L6.5 8z" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" fill="none" strokeWidth="1.8" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Diálogo de Cuenta */}
      <AuthDialog open={openAuth} onClose={() => setOpenAuth(false)} />
    </>
  );
}
