// src/lib/apiFetch.ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && (init as any).body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const apiMsg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors[0]?.message : undefined) ||
      (res.status === 401 ? "No autenticado" : "Error de red");
    throw new Error(apiMsg);
  }
  return json as T;
}
