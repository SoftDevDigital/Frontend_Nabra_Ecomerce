// src/lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001"; // ✅ backend por defecto

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  // Acepta JSON por defecto si no es FormData
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // Solo seteá JSON si NO es FormData y no está ya seteado
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include", // ✅ necesario para enviar/recibir cookies del backend
  });

  // 204 No Content: devolvemos undefined de forma segura
  if (res.status === 204) return undefined as unknown as T;

  const raw = await res.text();
  let json: any = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { /* puede no ser JSON */ }

  if (!res.ok) {
    const apiMsg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors[0]?.message : undefined) ||
      (res.status === 401 ? "Credenciales inválidas" : `HTTP ${res.status}`);
    throw new Error(apiMsg);
  }

  // Si no vino JSON, devolvés el texto crudo (por si alguna ruta no responde JSON)
  return (json ?? (raw as unknown)) as T;
}

export async function apiFetchMultipart<T = any>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // ¡OJO! NO seteamos Content-Type con FormData
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || `HTTP ${res.status}`);
  return json as T;
}

