// src/app/components/Header/Header.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AuthDialog from "../Auth/AuthDialog";
import HydrateGoogleOAuth from "@/app/components/Auth/HydrateGoogleOAuth"; // 👈 NUEVO
import styles from "./Header.module.css";
import SearchModal from "@/app/components/Search/SearchModal";

/* Helpers: detectar rol desde el JWT almacenado */
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
function hasRole(roleName: string): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  const norm = (r: any) => String(r).toLowerCase();
  if (Array.isArray(role)) return role.map(norm).includes(roleName.toLowerCase());
  if (typeof role === "string") return norm(role) === roleName.toLowerCase();
  return false;
}
function isAdminFromToken(): boolean { return hasRole("admin"); }
/* 👇 NUEVO: detectar rol user */
function isUserFromToken(): boolean { return hasRole("user"); }

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [openAuth, setOpenAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUser, setIsUser]   = useState(false); // 👈 NUEVO
  const [openMenu, setOpenMenu] = useState(false); // 👈 NUEVO
  const [openSearch, setOpenSearch] = useState(false);

  useEffect(() => { 
    setIsAdmin(isAdminFromToken()); 
    setIsUser(isUserFromToken());   // 👈 NUEVO
  }, []);

  return (
    <>
      <HydrateGoogleOAuth />

      <header className={styles.header} role="banner">
        <div className={styles.container}>
          {/* IZQ MOBILE: menú + buscar */}
          <div className={styles.actionsLeft} aria-label="Acciones izquierda">
            {/* Hamburger */}
            <button
              type="button"
              aria-label="Abrir menú"
              className={`${styles.iconBtn} ${styles.iconForce}`}
              onClick={() => setOpenMenu(true)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {/* Buscar (izquierda en mobile) */}
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              className={`${styles.iconBtn} ${styles.iconBtnSearch} ${styles.iconForce} ${styles.searchMobile}`}
              aria-label="Buscar"
              title="Buscar productos"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M20 20l-3.2-3.2" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* CENTRO: marca (centrada en mobile) */}
          <div className={styles.left}>
            <Link href="/" className={styles.brand} aria-label="NABRA - Inicio">
              <Image src="/logoNabra.png" alt="NABRA" width={172} height={48} priority />
            </Link>

            {/* Nav desktop */}
            <nav className={styles.nav} aria-label="Principal">
              <Link href="/" className={`${styles.link} ${isActive("/") ? styles.active : ""}`}>Inicio</Link>
              <Link href="/catalogo" className={`${styles.link} ${isActive("/catalogo") ? styles.active : ""}`}>Catálogo</Link>
              <Link href="/preventa" className={`${styles.link} ${isActive("/preventa") ? styles.active : ""}`}>Preventa</Link>
              {/* 👇 NUEVO: link visible solo para rol user */}
              {isUser && (
                <Link
                  href="/pedidos"
                  className={`${styles.link} ${isActive("/pedidos") ? styles.active : ""}`}
                >
                  Pedidos
                </Link>
              )}
              <Link href="/contacto" className={`${styles.link} ${isActive("/contacto") ? styles.active : ""}`}>Contacto</Link>

              {isAdmin && (
                <>
                  <Link
                    href="/admin/dashboard"
                    className={`${styles.link} ${isActive("/admin/dashboard") ? styles.active : ""}`}
                    title="Dashboard"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/admin/products"
                    className={`${styles.link} ${isActive("/admin/products") ? styles.active : ""}`}
                    title="Productos"
                  >
                    Productos
                  </Link>
                  
                  <Link href="/admin/productos/eliminar" className={`${styles.link} ${isActive("/admin/productos/eliminar") ? styles.active : ""}`} title="Eliminar producto">Eliminar producto</Link>
                </>
              )}
            </nav>
          </div>

          {/* DER: buscar (desktop) + cuenta + carrito */}
          <div className={styles.actions} aria-label="Acciones derecha">
            {/* ✅ NUEVO: Buscar visible en desktop (oculto en mobile vía CSS) */}
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              className={`${styles.iconBtn} ${styles.iconForce} ${styles.searchDesktop}`}
              aria-label="Buscar"
              title="Buscar productos"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M20 20l-3.2-3.2" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setOpenAuth(true)}
              className={`${styles.iconBtn} ${styles.iconForce}`}
              aria-label="Cuenta"
              title="Mi cuenta"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <Link
              href="/carrito"
              className={`${styles.iconBtn} ${styles.iconForce}`}
              aria-label="Carrito"
              title="Carrito"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M6.5 8h11l-1 11H7.5L6.5 8z" stroke="currentColor" fill="none" strokeWidth="1.8" />
                <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" fill="none" strokeWidth="1.8" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Drawer móvil */}
      {openMenu && (
        <div className={styles.drawerBackdrop} onClick={() => setOpenMenu(false)}>
          <aside className={styles.drawer} role="navigation" aria-label="Menú móvil" onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <button className={styles.closeBtn} aria-label="Cerrar" onClick={() => setOpenMenu(false)}>✕</button>
              <Link href="/" className={styles.drawerBrand} onClick={() => setOpenMenu(false)}>
                <Image src="/logoNabra.png" alt="NABRA" width={120} height={36} />
              </Link>
            </div>

            <ul className={styles.drawerList}>
              <li><Link href="/" onClick={() => setOpenMenu(false)}>Inicio</Link></li>
              <li><Link href="/catalogo" onClick={() => setOpenMenu(false)}>Catálogo</Link></li>
              <li><Link href="/preventa" onClick={() => setOpenMenu(false)}>Preventa</Link></li>
              {/* 👇 NUEVO: link en drawer solo para rol user */}
              {isUser && (
                <li><Link href="/pedidos" onClick={() => setOpenMenu(false)}>Pedidos</Link></li>
              )}
              <li><Link href="/contacto" onClick={() => setOpenMenu(false)}>Contacto</Link></li>

              {isAdmin && (
                <>
                  <li className={styles.drawerSep}>Admin</li>
                  <li><Link href="/admin/media" onClick={() => setOpenMenu(false)}>Media</Link></li>
                  <li><Link href="/admin/pedidos" onClick={() => setOpenMenu(false)}>Pedidos</Link></li>
                  <li><Link href="/admin/productos/nuevo" onClick={() => setOpenMenu(false)}>Crear producto</Link></li>
                  <li><Link href="/admin/productos/eliminar" onClick={() => setOpenMenu(false)}>Eliminar producto</Link></li>
                </>
              )}
            </ul>
          </aside>
        </div>
      )}

      <AuthDialog open={openAuth} onClose={() => setOpenAuth(false)} />
      <SearchModal open={openSearch} onClose={() => setOpenSearch(false)} />
    </>
  );
}
