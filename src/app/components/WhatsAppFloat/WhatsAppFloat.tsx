"use client";

import styles from "./WhatsAppFloat.module.css";

type Props = {
  /** Número en formato internacional sin + ni espacios. Ej: 523312442370 */
  phone: string;
  /** Mensaje inicial opcional */
  message?: string;
  /** Posición opcional */
  side?: "right" | "left";
  /** Offset opcional (px) desde los bordes */
  offset?: number;
};

export default function WhatsAppFloat({
  phone,
  message = "¡Hola! Quisiera hacer una consulta 😊",
  side = "right",
  offset = 16,
}: Props) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  const style: React.CSSProperties =
    side === "right"
      ? { right: offset, bottom: offset }
      : { left: offset, bottom: offset };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={styles.fab}
      style={style}
      aria-label="Chatear por WhatsApp"
      title="Chatear por WhatsApp"
    >
      {/* Ícono WhatsApp (SVG) */}
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.1 17.5c-.3-.2-1.8-.9-2-.9s-.5-.1-.7.3-.8.9-.9 1-.3.2-.6.1a7.6 7.6 0 0 1-2.3-1.4 8.5 8.5 0 0 1-1.6-2c-.2-.4 0-.5.1-.6l.5-.6c.1-.2.2-.4.3-.6s0-.4 0-.6l-.8-2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.7 3.7 0 0 0-1.2 2.8 6.5 6.5 0 0 0 1.4 3.2 14.7 14.7 0 0 0 5.7 5 10.6 10.6 0 0 0 1.8.7 4.4 4.4 0 0 0 2 .1 3.2 3.2 0 0 0 2.1-1.4 2.6 2.6 0 0 0 .2-1.4c0-.1-.3-.2-.6-.4zM16 4a12 12 0 0 0-10.3 18l-1.6 5.8 5.9-1.6A12 12 0 1 0 16 4zm7 19.1a9.7 9.7 0 0 1-4.9 2.6 9.7 9.7 0 0 1-7.6-1.5l-.5-.3-3.5.9.9-3.4-.3-.5A9.7 9.7 0 1 1 23 23.1z"
        />
      </svg>
    </a>
  );
}
