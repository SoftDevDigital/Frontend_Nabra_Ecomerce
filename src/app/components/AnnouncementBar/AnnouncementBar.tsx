"use client";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <div className={styles.inner}>
        ✨ ¡Envío <strong>GRATIS</strong> en compras mayores a <strong>$1,499.00 MXN</strong>! ✨👠
      </div>
    </div>
  );
}
