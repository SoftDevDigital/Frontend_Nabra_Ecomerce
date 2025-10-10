// src/app/components/Auth/AuthDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./AuthDialog.module.css";
import { startGoogleOAuth } from "@/lib/googleAuth"; // 👈 NUEVO

type Props = { open: boolean; onClose: () => void };

// 👇 NUEVO: helpers mínimos para estado de sesión
function hasToken(): boolean {
  try {
    return typeof window !== "undefined" && !!localStorage.getItem("nabra_token");
  } catch {
    return false;
  }
}
function getNameInitial(): string {
  try {
    const t = localStorage.getItem("nabra_token");
    if (!t) return "";
    const [, payload] = t.split(".");
    if (!payload) return "";
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))));
    const name = json?.name || json?.firstName || "";
    return (name || "").trim().charAt(0).toUpperCase();
  } catch {
    return "";
  }
}

export default function AuthDialog({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // 👇 NUEVO: estado sesión para cambiar CTA (login vs logout)
  const [loggedIn, setLoggedIn] = useState(false);
  const [initial, setInitial] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onClick);
      document.body.style.overflow = "hidden";
      // 👇 actualizar estado de sesión al abrir
      setLoggedIn(hasToken());
      setInitial(getNameInitial());
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // 👇 NUEVO: escuchar cambios de token (entre pestañas o después de login)
  useEffect(() => {
    const refresh = () => { setLoggedIn(hasToken()); setInitial(getNameInitial()); };
    const onStorage = (e: StorageEvent) => { if (e.key === "nabra_token") refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:login", refresh as any);
    window.addEventListener("auth:logout", refresh as any);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:login", refresh as any);
      window.removeEventListener("auth:logout", refresh as any);
    };
  }, []);

  // 👇 NUEVO: handler de logout
  function handleLogout() {
    try {
      localStorage.removeItem("nabra_token");
      // señales útiles para otras vistas
      window.dispatchEvent(new Event("auth:logout"));
    } catch {}
    onClose();
    router.push("/");
    router.refresh?.();
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.header}>
          <h2 id="account-title">Cuenta</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* 👇 CTA principal cambia según sesión */}
        {!loggedIn ? (
          <button
            type="button"
            className={styles.primaryCta}
            onClick={() => { onClose(); router.push("/auth"); }}
          >
            Iniciar sesión / Registrarme
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryCta}
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            // toque visual profesional (se mantiene accesible y adaptativo)
            style={{ background: "#111", color: "#fff" }}
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        )}

        {/* 👇 Botón Google opcional cuando NO hay sesión */}
        {!loggedIn && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => startGoogleOAuth("from-dialog")}
              aria-label="Continuar con Google"
              className={styles.ghostBtn}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 12, width: "100%", justifyContent: "center"
              }}
            >
              <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 31.9 29.2 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 5 28.9 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 19-8.9 19-20c0-1.3-.1-2.2-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16.4 19.1 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 5 28.9 3 24 3 16.5 3 9.9 7.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43c5.1 0 9.8-1.9 13.3-5.1l-6.1-4.9C29 34.8 26.6 36 24 36c-5.1 0-9.4-3.1-11.2-7.6l-6.6 5.1C9.8 38.7 16.4 43 24 43z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3C34.6 31.9 30.7 36 24 36c-5.1 0-9.4-3.1-11.2-7.6l-6.6 5.1C9.8 38.7 16.4 43 24 43c8.4 0 19-5.7 19-20 0-1.3-.1-2.2-.4-3.5z"/>
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>
        )}

        {/* Acciones secundarias */}
        <div className={styles.grid} style={{ marginTop: 12 }}>
          <Link href="/pedidos" className={styles.ghostBtn} onClick={onClose}>
            <span className={styles.iconWrap} aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M6 7h12l-1 12H7L6 7z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </span>
            Pedidos
          </Link>

          <Link href="/perfil" className={styles.ghostBtn} onClick={onClose}>
            <span className={styles.iconWrap} aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </span>
            Perfil
          </Link>
        </div>

        {/* 👇 Sutileza: avatar redondo con inicial cuando hay sesión (queda bien en iPhone SE/12/14) */}
        {loggedIn && (
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <div
              aria-hidden
              style={{
                width: 36, height: 36, borderRadius: "999px",
                background: "#f1f1f1", color: "#111",
                display: "grid", placeItems: "center", fontWeight: 700, letterSpacing: .3
              }}
              title="Sesión activa"
            >
              {initial || "✓"}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
