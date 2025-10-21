"use client";

import { useEffect, useState } from "react";

import s from "./PromoBar.module.css";
import { fetchActivePromotions, Promotion } from "@/lib/promotionsApi";

type Props = {
  /** Si querés forzar esconderlo desde arriba (opcional) */
  hidden?: boolean;
};

export default function PromoBar({ hidden }: Props) {
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const promos = await fetchActivePromotions();
        if (abort) return;
        // Elegimos la primera; ajustá la lógica si necesitás otra cosa
        setPromo(promos[0] ?? null);
      } catch {
        setPromo(null);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  if (hidden || closed || loading) return null;
  if (!promo) return null;

  // Texto a mostrar: probamos varias props comunes
  const text =
    promo.bannerText ||
    promo.title ||
    promo.message ||
    promo.description ||
    "¡Promoción activa!";

  // Colores opcionales que podría devolver la API
  const style: React.CSSProperties = {
    background: promo.bgColor || "#111",
    color: promo.textColor || "#fff",
  };

  return (
    <div className={s.bar} style={style} role="note" aria-live="polite">
      <div className={s.inner}>
        <span className={s.text}>{text}</span>

        {promo.linkUrl ? (
          <a className={s.link} href={promo.linkUrl} aria-label="Ver promoción">
            Ver más →
          </a>
        ) : null}

        <button
          type="button"
          className={s.close}
          aria-label="Cerrar promoción"
          onClick={() => setClosed(true)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
