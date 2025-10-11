// src/lib/productsApi.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://https://api.nabra.mx";

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

export async function fetchProducts(q: ProductsQuery = {}, init?: RequestInit): Promise<ProductsResponse> {
  const url = buildProductsUrl(q);
  const res = await fetch(url, { cache: "no-store", ...init });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(json?.message || "No se pudieron obtener los productos");
  }

  // soporta backend que devuelva plano o { success, data }
  if (json?.products && typeof json?.total === "number") return json;
  if (json?.data?.products) return json.data as ProductsResponse;

  // fallback ingenuo
  return {
    products: Array.isArray(json) ? json : json?.products ?? [],
    total: json?.total ?? (Array.isArray(json) ? json.length : 0),
    page: json?.page ?? 1,
    totalPages: json?.totalPages ?? 1,
  };
}

// --- Categories ----
export type CategoryCount = { category: string; count: number };

export async function fetchProductCategories(init?: RequestInit): Promise<CategoryCount[]> {
  const res = await fetch(`${API_BASE}/products/categories`, { cache: "no-store", ...init });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudieron obtener las categorías");

  // Soporta respuesta plana o { success, data }
  if (Array.isArray(json)) return json as CategoryCount[];
  if (Array.isArray(json?.data)) return json.data as CategoryCount[];
  return [];
}

// --- (Opcional) Detalle por ID: /products/:id ----
export async function fetchProductById(id: string, init?: RequestInit): Promise<ProductDto> {
  if (!id) throw new Error("Falta el id de producto");
  const res = await fetch(`${API_BASE}/products/${id}`, { cache: "no-store", ...init });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudo obtener el producto");

  // Soporta { success, data } o payload plano
  return (json?.data ?? json) as ProductDto;
}

// --- ✨ NUEVO: Stats por categoría /products/categories/:category/stats ----
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
  const res = await fetch(`${API_BASE}/products/categories/${enc}/stats`, { cache: "no-store", ...init });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(json?.message || "No se pudieron obtener las estadísticas de la categoría");

  // Soporta { success, data } o payload plano
  return (json?.data ?? json) as CategoryStats;
}

export const PRODUCTS_API_BASE = API_BASE;
