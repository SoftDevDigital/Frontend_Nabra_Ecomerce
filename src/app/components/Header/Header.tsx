// src/app/components/Header/Header.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AuthDialog from "../Auth/AuthDialog";
import HydrateGoogleOAuth from "@/app/components/Auth/HydrateGoogleOAuth"; // 👈 NUEVO
import styles from "./Header.module.css";

/* Helpers: detectar rol admin desde el JWT almacenado */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some(r => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [openAuth, setOpenAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { setIsAdmin(isAdminFromToken()); }, []);

  return (
    <>
      {/* 👇 Procesa ?token&user&login=success si viene del backend */}
      <HydrateGoogleOAuth />

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

              {/* ---- Admin links ---- */}
              {isAdmin && (
                <>
                  <Link
                    href="/admin/media"
                    className={`${styles.link} ${isActive("/admin/media") ? styles.active : ""}`}
                    title="Panel Admin - Medios"
                  >
                    Media
                  </Link>

                  <Link
                    href="/admin/pedidos"
                    className={`${styles.link} ${isActive("/admin/pedidos") ? styles.active : ""}`}
                    title="Panel Admin - Pedidos"
                  >
                    Pedidos
                  </Link>

                  {/* Crear */}
                  <Link
                    href="/admin/productos/nuevo"
                    className={`${styles.link} ${isActive("/admin/productos/nuevo") ? styles.active : ""}`}
                    title="Crear producto"
                  >
                    Crear producto
                  </Link>

                  {/* Actualizar (ancla a la sección de edición) */}
                  <Link
                    href="/admin/productos/nuevo#actualizar"
                    className={`${styles.link} ${isActive("/admin/productos/nuevo") ? styles.active : ""}`}
                    title="Actualizar producto"
                  >
                    Actualizar producto
                  </Link>

                  {/* ✅ Nuevo: Eliminar */}
                  <Link
                    href="/admin/productos/eliminar"
                    className={`${styles.link} ${isActive("/admin/productos/eliminar") ? styles.active : ""}`}
                    title="Eliminar producto"
                  >
                    Eliminar producto
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* DER: iconos */}
          <div className={styles.actions} aria-label="Acciones">
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

            <button
              type="button"
              onClick={() => setOpenAuth(true)}
              className={`${styles.iconBtn} ${styles.iconForce}`}
              aria-label="Cuenta"
              title="Mi cuenta"
              style={{ color: "#111" }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

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

      <AuthDialog open={openAuth} onClose={() => setOpenAuth(false)} />
    </>
  );
}
