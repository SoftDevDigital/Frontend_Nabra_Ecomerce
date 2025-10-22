"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./CuponesAdmin.module.css";

// ===== TIPOS =====
type Coupon = {
  _id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  promotionId: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  minimumPurchaseAmount?: number;
  validFrom: string;
  validUntil: string;
  isPublic: boolean;
  requiresMinimumItems: boolean;
  minimumItems?: number;
  totalUses: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CouponType = {
  value: string;
  label: string;
  description: string;
};

// ===== DATOS ESTÁTICOS =====
const COUPON_TYPES: CouponType[] = [
  { value: "percentage", label: "Descuento Porcentual", description: "Descuento del X%" },
  { value: "fixed_amount", label: "Descuento Monto Fijo", description: "Descuento de $X" },
  { value: "free_shipping", label: "Envío Gratis", description: "Envío gratuito" },
  { value: "buy_x_get_y", label: "Compra X Lleva Y", description: "2x1, 3x2, etc." },
];

// ===== UTILIDADES =====
function isAdminFromToken(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token");
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role === "admin";
  } catch {
    return false;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

function getTypeLabel(type: string): string {
  const typeObj = COUPON_TYPES.find(t => t.value === type);
  return typeObj?.label || type;
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ===== COMPONENTE PRINCIPAL =====
export default function CuponesAdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // ===== ESTADOS DEL FORMULARIO =====
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    type: "percentage",
    promotionId: "",
    maxUses: "",
    maxUsesPerUser: "",
    minimumPurchaseAmount: "",
    validFrom: "",
    validUntil: "",
    isPublic: true,
    requiresMinimumItems: false,
    minimumItems: "",
  });

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Cargar cupones
        const couponsResponse = await apiFetch("/promotions/admin/coupons", {
          method: "GET",
        });
        
        if (couponsResponse.success) {
          setCoupons(couponsResponse.data);
        } else {
          setError(couponsResponse.message || "Error al cargar cupones");
        }

        // Cargar promociones para el selector
        const promotionsResponse = await apiFetch("/promotions/admin/all", {
          method: "GET",
        });
        
        if (promotionsResponse.success) {
          setPromotions(promotionsResponse.data);
        }
      } catch (err) {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const couponData = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        promotionId: formData.promotionId,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
        maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : undefined,
        minimumPurchaseAmount: formData.minimumPurchaseAmount ? parseFloat(formData.minimumPurchaseAmount) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString(),
        isPublic: formData.isPublic,
        requiresMinimumItems: formData.requiresMinimumItems,
        minimumItems: formData.minimumItems ? parseInt(formData.minimumItems) : undefined,
      };

      const response = await apiFetch("/promotions/admin/coupons/create", {
        method: "POST",
        body: JSON.stringify(couponData),
      });

      if (response.success) {
        setCoupons([response.data, ...coupons]);
        setShowCreateForm(false);
        resetForm();
      } else {
        setError(response.message || "Error al crear cupón");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCoupon) return;

    try {
      const couponData = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        promotionId: formData.promotionId,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
        maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : undefined,
        minimumPurchaseAmount: formData.minimumPurchaseAmount ? parseFloat(formData.minimumPurchaseAmount) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString(),
        isPublic: formData.isPublic,
        requiresMinimumItems: formData.requiresMinimumItems,
        minimumItems: formData.minimumItems ? parseInt(formData.minimumItems) : undefined,
      };

      const response = await apiFetch(`/promotions/admin/coupons/update/${editingCoupon._id}`, {
        method: "PUT",
        body: JSON.stringify(couponData),
      });

      if (response.success) {
        setCoupons(coupons.map(c => c._id === editingCoupon._id ? response.data : c));
        setEditingCoupon(null);
        resetForm();
      } else {
        setError(response.message || "Error al actualizar cupón");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este cupón?")) return;

    try {
      const response = await apiFetch(`/promotions/admin/coupons/delete/${id}`, {
        method: "DELETE",
      });

      if (response.success) {
        setCoupons(coupons.filter(c => c._id !== id));
      } else {
        setError(response.message || "Error al eliminar cupón");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "percentage",
      promotionId: "",
      maxUses: "",
      maxUsesPerUser: "",
      minimumPurchaseAmount: "",
      validFrom: "",
      validUntil: "",
      isPublic: true,
      requiresMinimumItems: false,
      minimumItems: "",
    });
  };

  const startEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || "",
      type: coupon.type,
      promotionId: coupon.promotionId,
      maxUses: coupon.maxUses?.toString() || "",
      maxUsesPerUser: coupon.maxUsesPerUser?.toString() || "",
      minimumPurchaseAmount: coupon.minimumPurchaseAmount?.toString() || "",
      validFrom: new Date(coupon.validFrom).toISOString().slice(0, 16),
      validUntil: new Date(coupon.validUntil).toISOString().slice(0, 16),
      isPublic: coupon.isPublic,
      requiresMinimumItems: coupon.requiresMinimumItems,
      minimumItems: coupon.minimumItems?.toString() || "",
    });
    setShowCreateForm(true);
  };

  if (!isAdmin) {
    return (
      <main className={s.page}>
        <div className={s.panel}>
          <p>Necesitás permisos de administrador.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Gestión de Cupones</h1>
        <div className={s.headerActions}>
          <Link href="/admin/dashboard" className={s.backBtn}>
            ← Dashboard
          </Link>
          <Link href="/admin/promociones" className={s.backBtn}>
            ← Promociones
          </Link>
          <button
            className={s.createBtn}
            onClick={() => {
              setShowCreateForm(true);
              setEditingCoupon(null);
              resetForm();
            }}
          >
            + Nuevo Cupón
          </button>
        </div>
      </header>

      {error && <div className={s.error}>{error}</div>}

      {loading && <div className={s.loading}>Cargando cupones...</div>}

      {!loading && !error && (
        <>
          {/* Lista de Cupones */}
          <section className={s.section}>
            <h2 className={s.sectionTitle}>Cupones ({coupons.length})</h2>
            
            {coupons.length === 0 ? (
              <div className={s.emptyState}>
                <p>No hay cupones creados.</p>
                <button
                  className={s.createBtn}
                  onClick={() => setShowCreateForm(true)}
                >
                  Crear Primer Cupón
                </button>
              </div>
            ) : (
              <div className={s.couponsGrid}>
                {coupons.map((coupon) => (
                  <div key={coupon._id} className={s.couponCard}>
                    <div className={s.couponHeader}>
                      <h3 className={s.couponCode}>{coupon.code}</h3>
                      <span className={`${s.statusBadge} ${coupon.isActive ? s.active : s.inactive}`}>
                        {coupon.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    
                    <div className={s.couponInfo}>
                      <h4 className={s.couponName}>{coupon.name}</h4>
                      {coupon.description && (
                        <p className={s.couponDescription}>{coupon.description}</p>
                      )}
                      <div className={s.couponDetails}>
                        <span className={s.detail}>
                          <strong>Tipo:</strong> {getTypeLabel(coupon.type)}
                        </span>
                        <span className={s.detail}>
                          <strong>Promoción:</strong> {promotions.find(p => p._id === coupon.promotionId)?.name || "N/A"}
                        </span>
                        <span className={s.detail}>
                          <strong>Válido desde:</strong> {formatDate(coupon.validFrom)}
                        </span>
                        <span className={s.detail}>
                          <strong>Válido hasta:</strong> {formatDate(coupon.validUntil)}
                        </span>
                        <span className={s.detail}>
                          <strong>Usos:</strong> {coupon.totalUses}
                        </span>
                        {coupon.maxUses && (
                          <span className={s.detail}>
                            <strong>Máx. usos:</strong> {coupon.maxUses}
                          </span>
                        )}
                        {coupon.minimumPurchaseAmount && (
                          <span className={s.detail}>
                            <strong>Compra mínima:</strong> {formatMoney(coupon.minimumPurchaseAmount)}
                          </span>
                        )}
                        <span className={s.detail}>
                          <strong>Público:</strong> {coupon.isPublic ? "Sí" : "No"}
                        </span>
                      </div>
                    </div>
                    
                    <div className={s.couponActions}>
                      <button
                        className={s.editBtn}
                        onClick={() => startEdit(coupon)}
                      >
                        Editar
                      </button>
                      <button
                        className={s.deleteBtn}
                        onClick={() => handleDeleteCoupon(coupon._id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal de Creación/Edición */}
      {showCreateForm && (
        <div className={s.modalOverlay}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2>{editingCoupon ? "Editar Cupón" : "Nuevo Cupón"}</h2>
              <button
                className={s.closeBtn}
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form
              className={s.form}
              onSubmit={editingCoupon ? handleUpdateCoupon : handleCreateCoupon}
            >
              <div className={s.formGroup}>
                <label className={s.label}>Código del Cupón *</label>
                <div className={s.inputGroup}>
                  <input
                    type="text"
                    className={s.input}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    pattern="[A-Z0-9]+"
                    title="Solo letras mayúsculas y números"
                  />
                  <button
                    type="button"
                    className={s.generateBtn}
                    onClick={() => setFormData({ ...formData, code: generateCouponCode() })}
                  >
                    Generar
                  </button>
                </div>
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Nombre *</label>
                <input
                  type="text"
                  className={s.input}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Descripción</label>
                <textarea
                  className={s.textarea}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Tipo de Cupón *</label>
                  <select
                    className={s.select}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    {COUPON_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Promoción Asociada *</label>
                  <select
                    className={s.select}
                    value={formData.promotionId}
                    onChange={(e) => setFormData({ ...formData, promotionId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar promoción</option>
                    {promotions.map((promotion) => (
                      <option key={promotion._id} value={promotion._id}>
                        {promotion.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Fecha de Inicio *</label>
                  <input
                    type="datetime-local"
                    className={s.input}
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    required
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Fecha de Fin *</label>
                  <input
                    type="datetime-local"
                    className={s.input}
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Máximo de Usos</label>
                  <input
                    type="number"
                    className={s.input}
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    min="1"
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Máximo de Usos por Usuario</label>
                  <input
                    type="number"
                    className={s.input}
                    value={formData.maxUsesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsesPerUser: e.target.value })}
                    min="1"
                  />
                </div>
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Compra Mínima</label>
                <input
                  type="number"
                  className={s.input}
                  value={formData.minimumPurchaseAmount}
                  onChange={(e) => setFormData({ ...formData, minimumPurchaseAmount: e.target.value })}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    />
                    Cupón Público
                  </label>
                </div>

                <div className={s.formGroup}>
                  <label className={s.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.requiresMinimumItems}
                      onChange={(e) => setFormData({ ...formData, requiresMinimumItems: e.target.checked })}
                    />
                    Requiere Cantidad Mínima
                  </label>
                </div>
              </div>

              {formData.requiresMinimumItems && (
                <div className={s.formGroup}>
                  <label className={s.label}>Cantidad Mínima de Items</label>
                  <input
                    type="number"
                    className={s.input}
                    value={formData.minimumItems}
                    onChange={(e) => setFormData({ ...formData, minimumItems: e.target.value })}
                    min="1"
                  />
                </div>
              )}

              <div className={s.formActions}>
                <button
                  type="button"
                  className={s.cancelBtn}
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingCoupon(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={s.submitBtn}
                >
                  {editingCoupon ? "Actualizar" : "Crear"} Cupón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
