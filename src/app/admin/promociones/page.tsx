"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./PromocionesAdmin.module.css";

// ===== TIPOS =====
type Promotion = {
  _id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  target: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  totalUses: number;
  totalDiscountGiven: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type PromotionType = {
  value: string;
  label: string;
  description: string;
};

type PromotionTarget = {
  value: string;
  label: string;
  description: string;
};

type PromotionStatus = {
  value: string;
  label: string;
  color: string;
};

// ===== DATOS ESTÁTICOS =====
const PROMOTION_TYPES: PromotionType[] = [
  { value: "percentage", label: "Descuento Porcentual", description: "Descuento del X%" },
  { value: "fixed_amount", label: "Descuento Monto Fijo", description: "Descuento de $X" },
  { value: "free_shipping", label: "Envío Gratis", description: "Envío gratuito" },
  { value: "buy_x_get_y", label: "Compra X Lleva Y", description: "2x1, 3x2, etc." },
  { value: "quantity_discount", label: "Descuento por Cantidad", description: "Descuento por comprar X unidades" },
  { value: "category_discount", label: "Descuento por Categoría", description: "Descuento en categoría específica" },
  { value: "minimum_purchase", label: "Descuento por Compra Mínima", description: "Descuento al comprar más de $X" },
  { value: "flash_sale", label: "Oferta Relámpago", description: "Oferta por tiempo limitado" },
  { value: "pay_x_get_y", label: "Paga X Lleva Y", description: "Paga X cantidad y te llevas Y cantidad" },
  { value: "specific_product_discount", label: "Descuento Producto Específico", description: "Descuento en producto específico" },
  { value: "progressive_quantity_discount", label: "Descuento Progresivo", description: "Descuentos progresivos por cantidad" },
  { value: "bundle_offer", label: "Oferta de Paquete", description: "Ofertas de paquetes/combos" },
  { value: "cross_sell_discount", label: "Descuento Cruzado", description: "Descuento por comprar productos relacionados" },
  { value: "time_based_discount", label: "Descuento por Horario", description: "Descuento basado en horarios específicos" },
  { value: "loyalty_discount", label: "Descuento por Fidelidad", description: "Descuento para clientes fieles" },
  { value: "birthday_discount", label: "Descuento de Cumpleaños", description: "Descuento especial de cumpleaños" },
  { value: "first_purchase_discount", label: "Descuento Primera Compra", description: "Descuento para nuevos clientes" },
  { value: "abandoned_cart_discount", label: "Descuento Carrito Abandonado", description: "Descuento para recuperar carritos" },
  { value: "stock_clearance", label: "Liquidación de Stock", description: "Liquidación de productos con poco stock" },
  { value: "seasonal_discount", label: "Descuento Estacional", description: "Descuento por temporada" },
  { value: "volume_discount", label: "Descuento por Volumen", description: "Descuento por comprar en volumen" },
  { value: "combo_discount", label: "Descuento por Combo", description: "Descuento por combos específicos" },
  { value: "gift_with_purchase", label: "Regalo con Compra", description: "Regalo al comprar X cantidad" },
];

const PROMOTION_TARGETS: PromotionTarget[] = [
  { value: "all_products", label: "Todos los Productos", description: "Aplica a todos los productos" },
  { value: "specific_products", label: "Productos Específicos", description: "Aplica solo a productos seleccionados" },
  { value: "category", label: "Categoría", description: "Aplica a una categoría específica" },
  { value: "user_segment", label: "Segmento de Usuario", description: "Aplica a un segmento de usuarios" },
  { value: "first_time_buyers", label: "Primeros Compradores", description: "Aplica solo a nuevos clientes" },
  { value: "returning_customers", label: "Clientes Recurrentes", description: "Aplica solo a clientes que han comprado antes" },
];

const PROMOTION_STATUSES: PromotionStatus[] = [
  { value: "draft", label: "Borrador", color: "#6b7280" },
  { value: "active", label: "Activa", color: "#10b981" },
  { value: "paused", label: "Pausada", color: "#f59e0b" },
  { value: "expired", label: "Expirada", color: "#ef4444" },
  { value: "cancelled", label: "Cancelada", color: "#6b7280" },
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

function getStatusColor(status: string): string {
  const statusObj = PROMOTION_STATUSES.find(s => s.value === status);
  return statusObj?.color || "#6b7280";
}

function getTypeLabel(type: string): string {
  const typeObj = PROMOTION_TYPES.find(t => t.value === type);
  return typeObj?.label || type;
}

function getTargetLabel(target: string): string {
  const targetObj = PROMOTION_TARGETS.find(t => t.value === target);
  return targetObj?.label || target;
}

// ===== COMPONENTE PRINCIPAL =====
export default function PromocionesAdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  // ===== ESTADOS DEL FORMULARIO =====
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "percentage",
    target: "all_products",
    startDate: "",
    endDate: "",
    isActive: true,
    priority: 1,
    // Condiciones
    minimumPurchaseAmount: "",
    minimumQuantity: "",
    categories: [] as string[],
    // Reglas
    discountPercentage: "",
    discountAmount: "",
    buyQuantity: "",
    getQuantity: "",
    getDiscountPercentage: "",
  });

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchPromotions = async () => {
      try {
        setLoading(true);
        const response = await apiFetch("/promotions/admin/all", {
          method: "GET",
        });
        
        if (response.success) {
          setPromotions(response.data);
        } else {
          setError(response.message || "Error al cargar promociones");
        }
      } catch (err) {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [isAdmin]);

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const promotionData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        target: formData.target,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        conditions: {
          minimumPurchaseAmount: formData.minimumPurchaseAmount ? parseFloat(formData.minimumPurchaseAmount) : undefined,
          minimumQuantity: formData.minimumQuantity ? parseInt(formData.minimumQuantity) : undefined,
          categories: formData.categories,
        },
        rules: {
          discountPercentage: formData.discountPercentage ? parseFloat(formData.discountPercentage) : undefined,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : undefined,
          buyQuantity: formData.buyQuantity ? parseInt(formData.buyQuantity) : undefined,
          getQuantity: formData.getQuantity ? parseInt(formData.getQuantity) : undefined,
          getDiscountPercentage: formData.getDiscountPercentage ? parseFloat(formData.getDiscountPercentage) : undefined,
        },
        isActive: formData.isActive,
        priority: formData.priority,
      };

      const response = await apiFetch("/promotions/admin/create", {
        method: "POST",
        body: JSON.stringify(promotionData),
      });

      if (response.success) {
        setPromotions([response.data, ...promotions]);
        setShowCreateForm(false);
        resetForm();
      } else {
        setError(response.message || "Error al crear promoción");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleUpdatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingPromotion) return;

    try {
      const promotionData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        target: formData.target,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        conditions: {
          minimumPurchaseAmount: formData.minimumPurchaseAmount ? parseFloat(formData.minimumPurchaseAmount) : undefined,
          minimumQuantity: formData.minimumQuantity ? parseInt(formData.minimumQuantity) : undefined,
          categories: formData.categories,
        },
        rules: {
          discountPercentage: formData.discountPercentage ? parseFloat(formData.discountPercentage) : undefined,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : undefined,
          buyQuantity: formData.buyQuantity ? parseInt(formData.buyQuantity) : undefined,
          getQuantity: formData.getQuantity ? parseInt(formData.getQuantity) : undefined,
          getDiscountPercentage: formData.getDiscountPercentage ? parseFloat(formData.getDiscountPercentage) : undefined,
        },
        isActive: formData.isActive,
        priority: formData.priority,
      };

      const response = await apiFetch(`/promotions/admin/update/${editingPromotion._id}`, {
        method: "PUT",
        body: JSON.stringify(promotionData),
      });

      if (response.success) {
        setPromotions(promotions.map(p => p._id === editingPromotion._id ? response.data : p));
        setEditingPromotion(null);
        resetForm();
      } else {
        setError(response.message || "Error al actualizar promoción");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const handleDeletePromotion = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta promoción?")) return;

    try {
      const response = await apiFetch(`/promotions/admin/delete/${id}`, {
        method: "DELETE",
      });

      if (response.success) {
        setPromotions(promotions.filter(p => p._id !== id));
      } else {
        setError(response.message || "Error al eliminar promoción");
      }
    } catch (err) {
      setError("Error de conexión");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "percentage",
      target: "all_products",
      startDate: "",
      endDate: "",
      isActive: true,
      priority: 1,
      minimumPurchaseAmount: "",
      minimumQuantity: "",
      categories: [],
      discountPercentage: "",
      discountAmount: "",
      buyQuantity: "",
      getQuantity: "",
      getDiscountPercentage: "",
    });
  };

  const startEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || "",
      type: promotion.type,
      target: promotion.target,
      startDate: new Date(promotion.startDate).toISOString().slice(0, 16),
      endDate: new Date(promotion.endDate).toISOString().slice(0, 16),
      isActive: promotion.isActive,
      priority: promotion.priority,
      minimumPurchaseAmount: "",
      minimumQuantity: "",
      categories: [],
      discountPercentage: "",
      discountAmount: "",
      buyQuantity: "",
      getQuantity: "",
      getDiscountPercentage: "",
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
        <h1 className={s.title}>Gestión de Promociones</h1>
        <div className={s.headerActions}>
          <Link href="/admin/dashboard" className={s.backBtn}>
            ← Dashboard
          </Link>
          <button
            className={s.createBtn}
            onClick={() => {
              setShowCreateForm(true);
              setEditingPromotion(null);
              resetForm();
            }}
          >
            + Nueva Promoción
          </button>
        </div>
      </header>

      {error && <div className={s.error}>{error}</div>}

      {loading && <div className={s.loading}>Cargando promociones...</div>}

      {!loading && !error && (
        <>
          {/* Lista de Promociones */}
          <section className={s.section}>
            <h2 className={s.sectionTitle}>Promociones ({promotions.length})</h2>
            
            {promotions.length === 0 ? (
              <div className={s.emptyState}>
                <p>No hay promociones creadas.</p>
                <button
                  className={s.createBtn}
                  onClick={() => setShowCreateForm(true)}
                >
                  Crear Primera Promoción
                </button>
              </div>
            ) : (
              <div className={s.promotionsGrid}>
                {promotions.map((promotion) => (
                  <div key={promotion._id} className={s.promotionCard}>
                    <div className={s.promotionHeader}>
                      <h3 className={s.promotionName}>{promotion.name}</h3>
                      <span
                        className={s.statusBadge}
                        style={{ backgroundColor: getStatusColor(promotion.status) }}
                      >
                        {PROMOTION_STATUSES.find(s => s.value === promotion.status)?.label}
                      </span>
                    </div>
                    
                    <div className={s.promotionInfo}>
                      <p className={s.promotionDescription}>{promotion.description}</p>
                      <div className={s.promotionDetails}>
                        <span className={s.detail}>
                          <strong>Tipo:</strong> {getTypeLabel(promotion.type)}
                        </span>
                        <span className={s.detail}>
                          <strong>Target:</strong> {getTargetLabel(promotion.target)}
                        </span>
                        <span className={s.detail}>
                          <strong>Inicio:</strong> {formatDate(promotion.startDate)}
                        </span>
                        <span className={s.detail}>
                          <strong>Fin:</strong> {formatDate(promotion.endDate)}
                        </span>
                        <span className={s.detail}>
                          <strong>Usos:</strong> {promotion.totalUses}
                        </span>
                        <span className={s.detail}>
                          <strong>Descuento Total:</strong> {formatMoney(promotion.totalDiscountGiven)}
                        </span>
                      </div>
                    </div>
                    
                    <div className={s.promotionActions}>
                      <button
                        className={s.editBtn}
                        onClick={() => startEdit(promotion)}
                      >
                        Editar
                      </button>
                      <button
                        className={s.deleteBtn}
                        onClick={() => handleDeletePromotion(promotion._id)}
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
              <h2>{editingPromotion ? "Editar Promoción" : "Nueva Promoción"}</h2>
              <button
                className={s.closeBtn}
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingPromotion(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form
              className={s.form}
              onSubmit={editingPromotion ? handleUpdatePromotion : handleCreatePromotion}
            >
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
                  <label className={s.label}>Tipo de Promoción *</label>
                  <select
                    className={s.select}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    {PROMOTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Target *</label>
                  <select
                    className={s.select}
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    required
                  >
                    {PROMOTION_TARGETS.map((target) => (
                      <option key={target.value} value={target.value}>
                        {target.label}
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
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Fecha de Fin *</label>
                  <input
                    type="datetime-local"
                    className={s.input}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Prioridad</label>
                  <input
                    type="number"
                    className={s.input}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    min="1"
                    max="10"
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Promoción Activa
                  </label>
                </div>
              </div>

              {/* Condiciones */}
              <div className={s.formSection}>
                <h3 className={s.sectionTitle}>Condiciones</h3>
                
                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Monto Mínimo de Compra</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.minimumPurchaseAmount}
                      onChange={(e) => setFormData({ ...formData, minimumPurchaseAmount: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className={s.formGroup}>
                    <label className={s.label}>Cantidad Mínima</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.minimumQuantity}
                      onChange={(e) => setFormData({ ...formData, minimumQuantity: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Reglas */}
              <div className={s.formSection}>
                <h3 className={s.sectionTitle}>Reglas de Descuento</h3>
                
                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Porcentaje de Descuento</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.discountPercentage}
                      onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className={s.formGroup}>
                    <label className={s.label}>Monto de Descuento</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.discountAmount}
                      onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Compra X Cantidad</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.buyQuantity}
                      onChange={(e) => setFormData({ ...formData, buyQuantity: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div className={s.formGroup}>
                    <label className={s.label}>Lleva Y Cantidad</label>
                    <input
                      type="number"
                      className={s.input}
                      value={formData.getQuantity}
                      onChange={(e) => setFormData({ ...formData, getQuantity: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Descuento en Items "Lleva" (%)</label>
                  <input
                    type="number"
                    className={s.input}
                    value={formData.getDiscountPercentage}
                    onChange={(e) => setFormData({ ...formData, getDiscountPercentage: e.target.value })}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className={s.formActions}>
                <button
                  type="button"
                  className={s.cancelBtn}
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingPromotion(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={s.submitBtn}
                >
                  {editingPromotion ? "Actualizar" : "Crear"} Promoción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
