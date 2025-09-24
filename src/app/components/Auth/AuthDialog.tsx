// src/app/components/Auth/AuthDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./AuthDialog.module.css";
import { startGoogleOAuth } from "@/lib/googleAuth"; // 👈 NUEVO

type Props = { open: boolean; onClose: () => void };

export default function AuthDialog({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

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
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.header}>
          <h2 id="account-title">Cuenta</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* Solo 3 acciones: Iniciar sesión, Pedidos, Perfil */}
        <button
          type="button"
          className={styles.primaryCta}
          onClick={() => { onClose(); router.push("/auth"); }}
        >
          Iniciar sesión / Registrarme
        </button>

        {/* 👇 NUEVO: Google OAuth */}
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => { onClose(); startGoogleOAuth("from-auth-dialog"); }}
          aria-label="Continuar con Google"
          style={{ marginTop: 8 }}
        >
          {/* Simple ícono G */}
          <span className={styles.iconWrap} aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M21.35 11.1h-9.9v2.98h5.8c-.25 1.5-1.73 4.4-5.8 4.4-3.5 0-6.36-2.9-6.36-6.4s2.86-6.4 6.36-6.4c2 0 3.36.85 4.13 1.58l2.8-2.7C16.83 2.6 14.6 1.7 12.25 1.7 6.9 1.7 2.6 6 2.6 11.35s4.3 9.65 9.65 9.65c5.58 0 9.25-3.92 9.25-9.45 0-.64-.07-1.1-.15-1.45z" fill="currentColor"/>
            </svg>
          </span>
          Continuar con Google
        </button>

        <div className={styles.grid}>
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
      </div>
    </div>,
    document.body
  );
}
