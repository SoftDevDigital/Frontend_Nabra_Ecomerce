// src/lib/cartBadge.ts
export function setCartBadgeCount(count: number) {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  try {
    // 1) persistir
    localStorage.setItem("cart:count", String(safe));
    // 2) notificar a quien escuche (Header ya escucha estos eventos)
    window.dispatchEvent(new CustomEvent("cart:count", { detail: { count: safe } }));
    window.dispatchEvent(new CustomEvent("cart:changed", { detail: { count: safe } }));
  } catch {
    // no-op
  }
}

/** Utilidad para calcular el total de unidades del carrito */
export function computeItemsCount(items: Array<{ quantity?: number }>): number {
  return Array.isArray(items) ? items.reduce((acc, it) => acc + (Number(it?.quantity) || 0), 0) : 0;
}
