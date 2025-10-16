// src/lib/productsApi.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export type ProductsQuery = {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price" | "name" | "createdAt" | "relevance";
  sortOrder?: "asc" | "desc";
  isFeatured?: boolean;
  isPreorder?: boolean;
  size?: string;
};

export type ProductDto = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  sizes?: string[];
  images?: string[];
  isPreorder?: boolean;
  isFeatured?: boolean;
  createdAt?: string;
  [k: string]: any;
};

export type ProductsResponse = {
  products: ProductDto[];
  total: number;
  page: number;
  totalPages: number;
};

export function buildProductsUrl(q: ProductsQuery = {}) {
  const params = new URLSearchParams();
  if (q.page) params.set("page", String(q.page));
  if (q.limit) params.set("limit", String(q.limit));
  if (q.category) params.set("category", q.category);
  if (q.search) params.set("search", q.search);
  if (typeof q.minPrice === "number") params.set("minPrice", String(q.minPrice));
  if (typeof q.maxPrice === "number") params.set("maxPrice", String(q.maxPrice));
  if (q.sortBy) params.set("sortBy", q.sortBy);
  if (q.sortOrder) params.set("sortOrder", q.sortOrder);
  if (typeof q.isFeatured === "boolean") params.set("isFeatured", String(q.isFeatured));
  if (typeof q.isPreorder === "boolean") params.set("isPreorder", String(q.isPreorder));
  if (q.size) params.set("size", q.size);

  const qs = params.toString();
  return `${API_BASE}/products${qs ? `?${qs}` : ""}`;
}

/* ===== Helpers de normalización (NUEVOS) ===== */
function normalizeProducts(payload: any): ProductDto[] {
  // Arrays en distintas envolturas
  if (Array.isArray(payload)) return payload as ProductDto[];
  if (Array.isArray(payload?.products)) return payload.products as ProductDto[];
  if (Array.isArray(payload?.docs)) return payload.docs as ProductDto[];
  if (Array.isArray(payload?.data?.products)) return payload.data.products as ProductDto[];
  if (Array.isArray(payload?.data?.docs)) return payload.data.docs as ProductDto[];
  if (Array.isArray(payload?.data)) return payload.data as ProductDto[];

  // Único producto como objeto
  const maybeOne = payload?.data ?? payload;
  if (maybeOne && typeof maybeOne === "object" && maybeOne._id) {
    return [maybeOne as ProductDto];
  }
  return [];
}

function normalizeTotals(payload: any, listLen: number) {
  const page =
    Number(payload?.page) ??
    Number(payload?.data?.page) ??
    1;

  const total =
    Number(payload?.total) ??
    Number(payload?.data?.total) ??
    Number(payload?.pagination?.total) ??
    listLen;

  const limit =
    Number(payload?.limit) ??
    Number(payload?.data?.limit) ??
    (listLen > 0 ? listLen : 12);

  const totalPages =
    Number(payload?.totalPages) ??
    Number(payload?.data?.totalPages) ??
    Number(payload?.pagination?.totalPages) ??
    Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return { page, total, totalPages };
}

/* ===== fetchProducts endurecido (REEMPLAZO) ===== */
export async function fetchProducts(q: ProductsQuery = {}, init?: RequestInit): Promise<ProductsResponse> {
  const url = buildProductsUrl(q);
  
  // 🚀 OPTIMIZACIÓN: Usar caché inteligente basado en el tipo de consulta
  const cacheStrategy = q.isFeatured 
    ? { cache: "force-cache", next: { revalidate: 300 } } // 5 min para destacados
    : { cache: "force-cache", next: { revalidate: 60 } }; // 1 min para otros
  
  const res = await fetch(url, { ...cacheStrategy, ...init });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(json?.message || "No se pudieron obtener los productos");
  }

  // Acepta payload plano o { success, data }
  const payload = json?.data ?? json;

  // Soporta listas y también un único producto en data
  const products = normalizeProducts(payload);
  const { page, total, totalPages } = normalizeTotals(payload, products.length);

  return { products, total, page, totalPages };
}

/* --- Categories ---- */
export type CategoryCount = { category: string; count: number };

export async function fetchProductCategories(init?: RequestInit): Promise<CategoryCount[]> {
  const res = await fetch(`${API_BASE}/products/categories`, { 
    cache: "force-cache", 
    next: { revalidate: 600 }, // 10 min para categorías
    ...init 
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudieron obtener las categorías");

  // Soporta respuesta plana o { success, data }
  if (Array.isArray(json)) return json as CategoryCount[];
  if (Array.isArray(json?.data)) return json.data as CategoryCount[];
  return [];
}

/* --- Detalle por ID: /products/:id ---- */
export async function fetchProductById(id: string, init?: RequestInit): Promise<ProductDto> {
  if (!id) throw new Error("Falta el id de producto");
  const res = await fetch(`${API_BASE}/products/${id}`, { 
    cache: "force-cache", 
    next: { revalidate: 300 }, // 5 min para productos individuales
    ...init 
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudo obtener el producto");

  // Soporta { success, data } o payload plano
  return (json?.data ?? json) as ProductDto;
}

/* --- Stats por categoría /products/categories/:category/stats ---- */
export type CategoryStats = {
  category: string;
  totalProducts: number;
  priceRange: { min: number; max: number };
  averagePrice: number;
  availableSizes: string[];
  featuredProducts: number;
  preorderProducts: number;
};

export async function fetchCategoryStats(category: string, init?: RequestInit): Promise<CategoryStats> {
  if (!category) throw new Error("Falta la categoría");
  const enc = encodeURIComponent(category);
  const res = await fetch(`${API_BASE}/products/categories/${enc}/stats`, { 
    cache: "force-cache", 
    next: { revalidate: 600 }, // 10 min para estadísticas
    ...init 
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudieron obtener las estadísticas de la categoría");

  // Soporta { success, data } o payload plano
  return (json?.data ?? json) as CategoryStats;
}

export const PRODUCTS_API_BASE = API_BASE;
