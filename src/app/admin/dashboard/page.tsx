"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./AdminDashboard.module.css";

/* === Tipos dashboard existente === */
type Metrics = {
  users: { total: number };
  products: { total: number; lowStock: number };
  orders: { total: number; today: number; pending: number };
  revenue: { total: number };
  reviews: { pending: number };
  promotions: { active: number };
  coupons: { active: number };
};
type DashboardResponse =
  | { success: true; data: { metrics: Metrics; alerts: string[] }; message?: string }
  | { success: false; message: string };

/* === /admin/promotions/stats/summary === */
type PromoSummary = {
  promotions: { total: number; active: number };
  coupons: { total: number; active: number };
  usage: { totalUses: number; totalDiscountGiven: number };
};
type PromoSummaryResponse =
  | { success: true; data: PromoSummary; message?: string }
  | { success: false; message: string };

/* === NUEVO: /admin/stats/quick === */
type QuickStats = {
  users: number;
  products: number;
  orders: number;
  revenue: number;
  averageRating: number;
};
type QuickStatsResponse =
  | { success: true; data: QuickStats; message?: string }
  | { success: false; message: string };

/* === NUEVO: /promotions/active (públicas) === */
type Promotion = {
  _id: string;
  name?: string;
  description?: string;
  type?: string;
  discountPercent?: number;
  discountAmount?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  products?: any[];
  [k: string]: any;
};
type ActivePromosResponse =
  | { success: true; data: Promotion[]; message?: string }
  | { success: false; message: string };

/* Helpers role admin */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const [_, p2] = t.split(".");
    if (!p2) return null;
    const json = atob(p2.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  const role = p?.role || p?.roles || p?.userRole || p?.["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some(r => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

/* Money helpers */
function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  const [promoSummary, setPromoSummary] = useState<PromoSummary | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  /* NUEVO: estado quick */
  const [quick, setQuick] = useState<QuickStats | null>(null);
  const [quickErr, setQuickErr] = useState<string | null>(null);

  /* NUEVO: promociones activas públicas */
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [activeErr, setActiveErr] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      setErr(null);
      setPromoErr(null);
      setQuickErr(null);
      setActiveErr(null);
      try {
        const [dash, promo, qk, act] = await Promise.all([
          apiFetch<DashboardResponse>("/admin/dashboard", { method: "GET" }),
          apiFetch<PromoSummaryResponse>("/admin/promotions/stats/summary", { method: "GET" }),
          apiFetch<QuickStatsResponse>("/admin/stats/quick", { method: "GET" }),
          apiFetch<ActivePromosResponse>("/promotions/active", { method: "GET" }),
        ]);

        if (!("success" in dash) || !dash.success) {
          throw new Error(("message" in dash && dash.message) || "No se pudieron cargar las métricas");
        }
        setMetrics(dash.data.metrics);
        setAlerts(Array.isArray(dash.data.alerts) ? dash.data.alerts : []);

        if (("success" in promo) && promo.success) setPromoSummary(promo.data);
        else if ("success" in promo && !promo.success) setPromoErr(promo.message || "No se pudo cargar el resumen de promociones");

        if (("success" in qk) && qk.success) setQuick(qk.data);
        else if ("success" in qk && !qk.success) setQuickErr(qk.message || "No se pudo cargar el snapshot rápido");

        if (("success" in act) && act.success) setActivePromos(Array.isArray(act.data) ? act.data : []);
        else if ("success" in act && !act.success) setActiveErr(act.message || "No se pudieron cargar las promociones activas públicas");
      } catch (e: any) {
        const m = e?.message || "Error al cargar el dashboard";
        setErr(m);
        if (/(no autenticado|credenciales|401|unauthorized)/i.test(m)) {
          window.location.href = "/auth?redirectTo=/admin/dashboard";
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Dashboard (admin)</h1>
        <span className={s.back}>
          <Link href="/">Volver</Link>
        </span>
      </header>

      {!isAdmin && (
        <div className={s.panel}>
          <p>Necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          {loading && <p>Cargando…</p>}
          {err && !loading && <p className={s.error}>{err}</p>}

          {!loading && !err && (
            <>
              {/* Snapshot rápido */}
              <section className={s.section}>
                <div className={s.sectionTitle}>Snapshot rápido</div>

                {quickErr && <div className={s.error}>{quickErr}</div>}

                <div className={s.kpiGrid}>
                  {[
                    { label: "Users", value: quick?.users ?? 0 },
                    { label: "Products", value: quick?.products ?? 0 },
                    { label: "Orders", value: quick?.orders ?? 0 },
                    { label: "Revenue", value: formatMoney(quick?.revenue ?? 0, "USD") },
                    { label: "Avg. Rating", value: (quick?.averageRating ?? 0).toFixed(2) },
                  ].map((kpi) => (
                    <div key={kpi.label} className={s.kpiCard}>
                      <div className={s.kpiLabel}>{kpi.label}</div>
                      <div className={s.kpiValue}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* KPIs dashboard largo */}
              {metrics && (
                <section className={s.section}>
                  <div className={s.sectionTitle}>Métricas</div>
                  <div className={s.kpiGridWide}>
                    {[
                      { label: "Usuarios", value: metrics.users.total },
                      { label: "Productos", value: metrics.products.total },
                      { label: "Stock bajo", value: metrics.products.lowStock },
                      { label: "Pedidos", value: metrics.orders.total },
                      { label: "Pedidos hoy", value: metrics.orders.today },
                      { label: "Pendientes", value: metrics.orders.pending },
                      { label: "Ingresos", value: metrics.revenue.total },
                      { label: "Reviews pend.", value: metrics.reviews.pending },
                      { label: "Promos activas (admin)", value: metrics.promotions.active },
                      { label: "Cupones activos", value: metrics.coupons.active },
                    ].map((kpi) => (
                      <div key={kpi.label} className={s.kpiCard}>
                        <div className={s.kpiLabel}>{kpi.label}</div>
                        <div className={s.kpiValue}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Promociones & Cupones */}
              <section className={s.section}>
                <div className={s.sectionTitle}>Promociones & Cupones</div>
                {promoErr && <div className={s.error}>{promoErr}</div>}

                {promoSummary && (
                  <div className={s.cardsGrid}>
                    <div className={s.panel}>
                      <div className={s.kpiLabel} style={{ marginBottom: 6 }}>Promociones</div>
                      <div className={s.row}>
                        <div>
                          <div className={s.kpiLabel}>Total</div>
                          <div className={s.kpiValue}>{promoSummary.promotions.total}</div>
                        </div>
                        <div>
                          <div className={s.kpiLabel}>Activas (admin)</div>
                          <div className={s.kpiValue}>{promoSummary.promotions.active}</div>
                        </div>
                      </div>
                    </div>

                    <div className={s.panel}>
                      <div className={s.kpiLabel} style={{ marginBottom: 6 }}>Cupones</div>
                      <div className={s.row}>
                        <div>
                          <div className={s.kpiLabel}>Total</div>
                          <div className={s.kpiValue}>{promoSummary.coupons.total}</div>
                        </div>
                        <div>
                          <div className={s.kpiLabel}>Activos</div>
                          <div className={s.kpiValue}>{promoSummary.coupons.active}</div>
                        </div>
                      </div>
                    </div>

                    <div className={s.panel}>
                      <div className={s.kpiLabel} style={{ marginBottom: 6 }}>Uso</div>
                      <div className={s.usageGrid}>
                        <div className={s.usageRow}>
                          <span className={s.kpiLabel}>Total de usos</span>
                          <strong>{promoSummary.usage.totalUses}</strong>
                        </div>
                        <div className={s.usageRow}>
                          <span className={s.kpiLabel}>Descuento total otorgado</span>
                          <strong>{formatMoney(promoSummary.usage.totalDiscountGiven, "USD")}</strong>
                        </div>
                      </div>
                    </div>

                    <div className={s.panel}>
                      <div className={s.kpiLabel} style={{ marginBottom: 6 }}>Activas (público)</div>
                      {activeErr && <div className={s.error} style={{ fontSize: 12 }}>{activeErr}</div>}
                      {!activeErr && (
                        <>
                          <div className={s.kpiValue} style={{ marginBottom: 6 }}>{activePromos.length}</div>
                          <ul className={s.panelList}>
                            {activePromos.slice(0, 4).map(p => (
                              <li key={p._id}>
                                {(p.name || "(Promo)")}{p.discountPercent ? ` • ${p.discountPercent}%` : ""}
                              </li>
                            ))}
                            {activePromos.length === 0 && <li>Sin promociones activas públicas.</li>}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className={s.actionsRow}>
                  <Link href="/admin/products" className={s.btn} title="Ir a productos/promos">
                    Ver productos y promos
                  </Link>
                </div>
              </section>

              {/* Alertas */}
              <section className={s.section}>
                <div className={s.sectionTitle}>Alertas</div>
                <div className={s.panel}>
                  {alerts.length === 0 ? (
                    <div className={s.empty}>Sin alertas.</div>
                  ) : (
                    <ul className={s.panelList}>
                      {alerts.map((a, i) => (<li key={i}>{a}</li>))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
