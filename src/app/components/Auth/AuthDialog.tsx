// src/app/components/Auth/AuthDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./AuthDialog.module.css";

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
