"use client";

import { useCallback, useRef, useState } from "react";
import ReactDOM from "react-dom";
import styles from "./FlyToCart.module.css";

type Point = { x: number; y: number };

function getCenter(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function useFlyToCart() {
  const [nodes, setNodes] = useState<JSX.Element[]>([]);
  const idRef = useRef(0);

  const fly = useCallback(async (imgEl: HTMLImageElement, cartTargetEl: HTMLElement) => {
    if (!imgEl || !cartTargetEl) return;

    const start = getCenter(imgEl);
    const end = getCenter(cartTargetEl);

    const flyId = `fly-${++idRef.current}`;

    const cloneSrc = imgEl.currentSrc || imgEl.src;
    const size = Math.max(50, Math.min(imgEl.width, 80)); // tamaño del “chip” volador (responsive)
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const angle = Math.atan2(dy, dx); // para una leve rotación
    const distance = Math.hypot(dx, dy);
    const duration = Math.min(1100, Math.max(600, distance)); // tiempo dinámico según distancia

    const node = (
      <div
        key={flyId}
        className={styles.flying}
        style={{
          width: size,
          height: size,
          transform: `translate(${start.x - size / 2}px, ${start.y - size / 2}px)`,
          animationDuration: `${duration}ms`,
        }}
        onAnimationEnd={() => {
          setNodes((prev) => prev.filter((n) => (n.key as string) !== flyId));
          // pequeño “bump” en el carrito al final
          cartTargetEl.classList.add(styles.bump);
          setTimeout(() => cartTargetEl.classList.remove(styles.bump), 220);
        }}
      >
        <img
          className={styles.flyingImg}
          src={cloneSrc}
          alt=""
          style={{
            transform: `rotate(${angle * 0.1}rad)`,
          }}
        />
        {/* trayecto en CSS var */}
        <style jsx>{`
          .${styles.flying}{
            --dx:${dx}px;
            --dy:${dy}px;
          }
        `}</style>
      </div>
    );

    setNodes((prev) => [...prev, node]);
  }, []);

  // Portal sobre <body> para no romper layout
  const Portal = () => (typeof window !== "undefined" ? ReactDOM.createPortal(nodes, document.body) : null);

  return { fly, Portal };
}
