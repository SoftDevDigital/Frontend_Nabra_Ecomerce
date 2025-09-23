// src/lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  // Solo seteá JSON si NO es FormData y no está ya seteado
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    // Dejá esto en false a menos que realmente uses cookies de backend
    // credentials: "include",
  });

  // 204 No Content: devolvemos undefined/null de forma segura
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  // Intentamos parsear JSON; si está vacío, devolvemos null
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // Soporta {message}, {error}, o arrays típicos de validación
    const apiMsg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors[0]?.message : undefined) ||
      (res.status === 401 ? "Credenciales inválidas" : "Error de red");
    throw new Error(apiMsg);
  }

  return json as T;
}
