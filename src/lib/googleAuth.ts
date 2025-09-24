// src/lib/googleAuth.ts
import { apiFetch } from "@/lib/api";

export type GoogleUser = {
  _id: string;
  googleId?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  isGoogleUser?: boolean;
  linkedUserId?: string | null;
};

export async function startGoogleOAuth(state = "default") {
  const res = await apiFetch<{ success: boolean; data: { authUrl: string; state: string } }>(
    `/auth/google/auth-url${state ? `?state=${encodeURIComponent(state)}` : ""}`,
    { method: "GET" }
  );
  const url = res?.data?.authUrl;
  if (!url) throw new Error("No se pudo obtener la URL de Google.");
  // Redirigimos al consentimiento de Google
  window.location.href = url;
}

/**
 * Lee ?token=...&user=...&login=success de la URL actual,
 * persiste credenciales y limpia la querystring.
 * Retorna true si procesó algo.
 */
export function consumeGoogleRedirect(opts?: {
  onDoneRedirectTo?: string; // e.g. "/perfil" o "/"
}): boolean {
  if (typeof window === "undefined") return false;
  const u = new URL(window.location.href);
  const token = u.searchParams.get("token");
  const userStr = u.searchParams.get("user");
  const login = u.searchParams.get("login");

  if (token && userStr && login === "success") {
    try {
      // Guarda token y usuario
      localStorage.setItem("nabra_token", token);
      // user puede venir URI-encoded; probamos parsear dos veces si hace falta
      const decoded = decodeURIComponent(userStr);
      const user: GoogleUser = JSON.parse(decoded);
      localStorage.setItem("nabra_user", JSON.stringify(user));
    } catch {
      // Si falla el decodeURIComponent porque ya venía decodificado:
      try {
        const user: GoogleUser = JSON.parse(userStr as string);
        localStorage.setItem("nabra_user", JSON.stringify(user));
      } catch (e) {
        console.error("No se pudo parsear el usuario de Google:", e);
      }
    }

    // Limpia la query de la URL sin recargar
    u.searchParams.delete("token");
    u.searchParams.delete("user");
    u.searchParams.delete("login");
    window.history.replaceState({}, "", u.toString());

    // Redirige a donde prefieras
    const to = opts?.onDoneRedirectTo || "/perfil";
    if (to) window.location.replace(to);
    return true;
  }
  return false;
}
