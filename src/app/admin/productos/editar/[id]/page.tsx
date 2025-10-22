"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./EditProduct.module.css";

// ===== TIPOS =====
type ProductIn = {
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string | string[];
  images?: string[];
  stockBySize?: Record<string, number>;
  isPreorder?: boolean;
  isFeatured?: boolean;
};

type ProductOut = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[] | string;
  images?: string[];
  stockBySize?: Record<string, number> | string | null;
  isPreorder: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  updatedAt?: string;
  createdAt?: string;
  [k: string]: any;
};

type Promotion = {
  _id: string;
  name: string;
  type: string;
  status: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

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

function getBearer(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function parseCsvToArray(input: string): string[] {
  return (input || "").split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
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

// ===== COMPONENTE PRINCIPAL =====
export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductOut | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [saving, setSaving] = useState(false);

  // ===== ESTADOS DEL FORMULARIO =====
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    sizesText: "",
    imagesText: "",
    stockBySizeText: "",
    isPreorder: false,
    isFeatured: false,
    isActive: true,
  });

  // ===== ESTADOS DE PROMOCIONES =====
  const [showPromotions, setShowPromotions] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<string>("");
  const [applyingPromotion, setApplyingPromotion] = useState(false);

  // ===== REFS =====
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  useEffect(() => {
    if (isAdmin && productId) {
      loadProduct();
      loadPromotions();
    }
  }, [isAdmin, productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const bearer = getBearer();
      const response = await apiFetch<ProductOut>(`/products/${productId}`, {
        method: "GET",
        headers: { 
          Accept: "application/json", 
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) 
        },
      });

      if (response && response._id) {
        setProduct(response);
        fillFormFromProduct(response);
      } else {
        setError("Producto no encontrado");
      }
    } catch (err: any) {
      setError(err?.message || "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const response = await apiFetch("/promotions/admin/all", {
        method: "GET",
      });

      if (response.success) {
        setPromotions(response.data.filter((p: Promotion) => p.isActive));
      }
    } catch (err) {
      console.error("Error al cargar promociones:", err);
    }
  };

  const fillFormFromProduct = (p: ProductOut) => {
    setFormData({
      name: p.name || "",
      description: p.description || "",
      price: p.price?.toString() || "",
      category: p.category || "",
      sizesText: Array.isArray(p.sizes) ? p.sizes.join(", ") : p.sizes || "",
      imagesText: Array.isArray(p.images) ? p.images.join(", ") : "",
      stockBySizeText: typeof p.stockBySize === "object" && p.stockBySize 
        ? Object.entries(p.stockBySize).map(([size, stock]) => `${size}:${stock}`).join(", ")
        : "",
      isPreorder: p.isPreorder || false,
      isFeatured: p.isFeatured || false,
      isActive: p.isActive !== false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;

    try {
      setSaving(true);
      setError(null);

      const sizes = parseCsvToArray(formData.sizesText);
      const images = parseCsvToArray(formData.imagesText);
      
      // Parsear stock por tamaño
      const stockBySize: Record<string, number> = {};
      if (formData.stockBySizeText) {
        formData.stockBySizeText.split(",").forEach(item => {
          const [size, stock] = item.trim().split(":");
          if (size && stock && !isNaN(Number(stock))) {
            stockBySize[size.trim()] = parseInt(stock.trim());
          }
        });
      }

      const productData: ProductIn = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        sizes: sizes,
        images: images,
        stockBySize: Object.keys(stockBySize).length > 0 ? stockBySize : undefined,
        isPreorder: formData.isPreorder,
        isFeatured: formData.isFeatured,
      };

      const bearer = getBearer();
      const response = await apiFetch(`/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
        },
        body: JSON.stringify(productData),
      });

      if (response.success) {
        setProduct(response.data);
        setError(null);
        alert("Producto actualizado correctamente");
      } else {
        setError(response.message || "Error al actualizar el producto");
      }
    } catch (err: any) {
      setError(err?.message || "Error al actualizar el producto");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPromotion = async () => {
    if (!selectedPromotion || !product) return;

    try {
      setApplyingPromotion(true);
      
      // Aquí podrías implementar la lógica para aplicar la promoción
      // Por ejemplo, actualizar el precio del producto con el descuento
      alert(`Promoción aplicada al producto: ${selectedPromotion}`);
      
      setShowPromotions(false);
      setSelectedPromotion("");
    } catch (err: any) {
      setError(err?.message || "Error al aplicar la promoción");
    } finally {
      setApplyingPromotion(false);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFiles || imageFiles.length === 0) return;

    try {
      setSaving(true);
      
      const formData = new FormData();
      Array.from(imageFiles).forEach((file, index) => {
        formData.append(`images`, file);
      });

      const bearer = getBearer();
      const response = await apiFetch(`/products/${productId}/images`, {
        method: "POST",
        headers: {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
        },
        body: formData,
      });

      if (response.success) {
        // Recargar el producto para obtener las nuevas imágenes
        await loadProduct();
        alert("Imágenes subidas correctamente");
      } else {
        setError(response.message || "Error al subir las imágenes");
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir las imágenes");
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <main className={s.page}>
        <div className={s.loading}>Cargando producto...</div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className={s.page}>
        <div className={s.error}>{error || "Producto no encontrado"}</div>
        <Link href="/admin/products" className={s.backBtn}>
          ← Volver a Productos
        </Link>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Editar Producto</h1>
        <div className={s.headerActions}>
          <Link href="/admin/products" className={s.backBtn}>
            ← Volver a Productos
          </Link>
          <button
            className={s.promotionBtn}
            onClick={() => setShowPromotions(true)}
          >
            🎯 Aplicar Promoción
          </button>
        </div>
      </header>

      {error && <div className={s.error}>{error}</div>}

      <form className={s.form} onSubmit={handleSubmit}>
        <div className={s.formSection}>
          <h2 className={s.sectionTitle}>Información Básica</h2>
          
          <div className={s.formGroup}>
            <label className={s.label}>Nombre del Producto *</label>
            <input
              type="text"
              className={s.input}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Descripción *</label>
            <textarea
              className={s.textarea}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.label}>Precio *</label>
              <input
                type="number"
                className={s.input}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.label}>Categoría *</label>
              <input
                type="text"
                className={s.input}
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        <div className={s.formSection}>
          <h2 className={s.sectionTitle}>Talles y Stock</h2>
          
          <div className={s.formGroup}>
            <label className={s.label}>Talles (separados por comas)</label>
            <input
              type="text"
              className={s.input}
              value={formData.sizesText}
              onChange={(e) => setFormData({ ...formData, sizesText: e.target.value })}
              placeholder="35, 36, 37, 38, 39, 40"
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Stock por Talle (formato: talle:cantidad)</label>
            <input
              type="text"
              className={s.input}
              value={formData.stockBySizeText}
              onChange={(e) => setFormData({ ...formData, stockBySizeText: e.target.value })}
              placeholder="35:10, 36:15, 37:20, 38:25, 39:30, 40:20"
            />
          </div>
        </div>

        <div className={s.formSection}>
          <h2 className={s.sectionTitle}>Imágenes</h2>
          
          <div className={s.formGroup}>
            <label className={s.label}>URLs de Imágenes (separadas por comas)</label>
            <textarea
              className={s.textarea}
              value={formData.imagesText}
              onChange={(e) => setFormData({ ...formData, imagesText: e.target.value })}
              rows={3}
              placeholder="https://ejemplo.com/imagen1.jpg, https://ejemplo.com/imagen2.jpg"
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Subir Imágenes</label>
            <input
              ref={imagesInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setImageFiles(e.target.files)}
              className={s.fileInput}
            />
            {imageFiles && imageFiles.length > 0 && (
              <button
                type="button"
                className={s.uploadBtn}
                onClick={handleImageUpload}
                disabled={saving}
              >
                {saving ? "Subiendo..." : `Subir ${imageFiles.length} imagen(es)`}
              </button>
            )}
          </div>
        </div>

        <div className={s.formSection}>
          <h2 className={s.sectionTitle}>Configuración</h2>
          
          <div className={s.checkboxGroup}>
            <label className={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isPreorder}
                onChange={(e) => setFormData({ ...formData, isPreorder: e.target.checked })}
              />
              Es Preventa
            </label>

            <label className={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              />
              Es Destacado
            </label>

            <label className={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Está Activo
            </label>
          </div>
        </div>

        <div className={s.formActions}>
          <button
            type="button"
            className={s.cancelBtn}
            onClick={() => router.back()}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={s.saveBtn}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>

      {/* Modal de Promociones */}
      {showPromotions && (
        <div className={s.modalOverlay}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2>Aplicar Promoción</h2>
              <button
                className={s.closeBtn}
                onClick={() => {
                  setShowPromotions(false);
                  setSelectedPromotion("");
                }}
              >
                ×
              </button>
            </div>
            
            <div className={s.modalContent}>
              <p>Selecciona una promoción para aplicar a este producto:</p>
              
              <div className={s.promotionsList}>
                {promotions.length === 0 ? (
                  <p className={s.noPromotions}>No hay promociones activas disponibles.</p>
                ) : (
                  promotions.map((promotion) => (
                    <div
                      key={promotion._id}
                      className={`${s.promotionItem} ${selectedPromotion === promotion._id ? s.selected : ""}`}
                      onClick={() => setSelectedPromotion(promotion._id)}
                    >
                      <div className={s.promotionName}>{promotion.name}</div>
                      <div className={s.promotionType}>{promotion.type}</div>
                      <div className={s.promotionDates}>
                        {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className={s.modalActions}>
              <button
                className={s.cancelBtn}
                onClick={() => {
                  setShowPromotions(false);
                  setSelectedPromotion("");
                }}
              >
                Cancelar
              </button>
              <button
                className={s.applyBtn}
                onClick={handleApplyPromotion}
                disabled={!selectedPromotion || applyingPromotion}
              >
                {applyingPromotion ? "Aplicando..." : "Aplicar Promoción"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
