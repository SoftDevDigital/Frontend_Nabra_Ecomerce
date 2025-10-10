// src/lib/googleAuth.ts
"use client";

import { apiFetch } from "@/lib/api";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://https://api.nabra.mx";
}

/* ✅ NUEVO: intento obtener un token desde el servidor (cookie-only) */
export async function tryHydrateTokenFromServer(): Promise<string | null> {
  // Ajustá el orden/paths según lo que exponga tu backend.
  const candidates = [
    "/auth/token",
    "/auth/me",
    "/auth/profile",
    "/auth/session",
    "/auth/protected",
  ];

  for (const path of candidates) {
    try {
      const r = await apiFetch<any>(path, { method: "GET" });
      const token =
        r?.data?.access_token ||
        r?.access_token ||
        r?.token ||
        r?.jwt ||
        null;

      if (token && typeof token === "string") return token;

      // Si tu endpoint no devuelve token pero confirma sesión,
      // podés modificar esto para construir uno o pedir otro recurso.
    } catch {
      // seguir probando con el siguiente path
    }
  }
  return null;
}

/**
 * Abre el flujo de Google OAuth redirigiendo al backend.
 * - Incluye redirect_uri/redirectTo al callback del front.
 * - Propaga un "finalRedirect" (si venías con ?redirectTo=/x).
 */
export function startGoogleOAuth(source: string = "auth-page") {
  const API_BASE = getApiBase();
  const callbackUrl = `${window.location.origin}/auth/google/callback`;

  // Si la URL actual trae redirectTo, lo encadenamos para volver ahí al final
  const current = new URL(window.location.href);
  const finalRedirect = current.searchParams.get("redirectTo") || "/";

  // Usamos "state" para llevar contexto (source, finalRedirect)
  const state = btoa(
    JSON.stringify({
      source,
      finalRedirect,
      ts: Date.now(),
    })
  );

  const url = new URL(`${API_BASE}/auth/google`);
  // Soporto ambos nombres por si el backend espera uno u otro
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("redirectTo", callbackUrl);
  url.searchParams.set("state", state);

  // Redirige (window.location para evitar problemas de popup blockers)
  window.location.href = url.toString();
}

/**
 * Lee parámetros del callback y devuelve la info necesaria:
 * - access_token (si el backend lo devuelve directo)
 * - code (si el backend hace Authorization Code y hay que intercambiar)
 * - finalRedirect (desde state) para saber a dónde volver al final
 */
export function parseGoogleCallbackParams() {
  const url = new URL(window.location.href);
  const q = url.searchParams;

  const token =
    q.get("access_token") ||
    q.get("token") ||
    q.get("jwt") ||
    undefined;

  const code = q.get("code") || undefined;
  const stateRaw = q.get("state") || "";
  let finalRedirect = "/";

  if (stateRaw) {
    try {
      const decoded = JSON.parse(atob(stateRaw));
      if (decoded?.finalRedirect && typeof decoded.finalRedirect === "string") {
        finalRedirect = decoded.finalRedirect || "/";
      }
    } catch {
      /* ignore */
    }
  }

  return { token, code, finalRedirect };
}

/**
 * Si el backend usa Authorization Code, intercambiamos `code` por token.
 * Endpoint típico sugerido: POST /auth/google/exchange
 * Si tu backend usa otro path, cámbialo acá.
 */
export async function exchangeCodeForToken(code: string, callbackUrl: string) {
  // Ajustá esta ruta si tu backend define otra para el exchange
  const res = await apiFetch<{ success: boolean; data?: { access_token?: string } }>(
    "/auth/google/exchange",
    {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: callbackUrl }),
    }
  );
  const token = res?.data?.access_token;
  if (!token) throw new Error("No se recibió token del exchange.");
  return token;
}

export async function consumeGoogleRedirect(opts?: { onDoneRedirectTo?: string }) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  /* ✅ NUEVO: normaliza casos con ?error=foo?error=bar */
  if (/\?error=.+\?error=/.test(url.href)) {
    const fixedHref = url.href.replace(
      /\?error=([^?]+)\?error=/,
      (_m, g1) => `?error=${encodeURIComponent(g1)}&error=`
    );
    window.history.replaceState({}, "", fixedHref);
  }

  const q = new URLSearchParams(window.location.search);

  /* ✅ NUEVO: si viene error, enviamos a /auth con el mensaje (y preservamos redirectTo) */
  const maybeError =
    q.getAll("error").find(Boolean) ||
    q.get("error_description") ||
    q.get("message") ||
    null;

  if (
    maybeError &&
    !q.get("access_token") &&
    !q.get("token") &&
    !q.get("jwt") &&
    !q.get("code")
  ) {
    const redirectTo = q.get("redirectTo") || "/";
    const to = new URL(`${window.location.origin}/auth`);
    to.searchParams.set("error", maybeError);
    if (redirectTo) to.searchParams.set("redirectTo", redirectTo);

    // Limpio address bar y redirijo al flujo real
    window.history.replaceState({}, "", window.location.pathname);
    window.location.replace(to.toString());
    return;
  }

  // Token directo en query (variantes comunes)
  let token =
    q.get("access_token") ||
    q.get("token") ||
    q.get("jwt") ||
    undefined;

  // Algunos backends dejan una marca de éxito
  const loginSuccess = (q.get("login") || "").toLowerCase() === "success";

  // Si vino un code (Authorization Code), delegá al callback page
  const code = q.get("code");
  if (code && !token) {
    // mejor llevar al callback dedicado que hace el exchange
    const callbackUrl = `${window.location.origin}/auth/google/callback${window.location.search}`;
    window.location.replace(callbackUrl);
    return;
  }

  /* ✅ NUEVO: flujo cookie-only (login=success sin token en URL) -> hidratar desde server */
  if (!token && loginSuccess) {
    try {
      const hydrated = await tryHydrateTokenFromServer();
      if (hydrated) token = hydrated;
    } catch {
      // ignore
    }
  }

  // Si no hay nada que procesar, salimos en silencio
  if (!token && !loginSuccess) return;

  // Persistir token si vino
  if (token) {
    try {
      localStorage.setItem("nabra_token", token);
      window.dispatchEvent(new CustomEvent("auth:login", { detail: { provider: "google" } }));
    } catch { /* noop */ }
  }

  // Destino final de navegación
  const fromQuery = q.get("redirectTo");
  const to = fromQuery || opts?.onDoneRedirectTo || "/";

  // Limpiar la query actual (remueve token/code/etc. del address bar)
  try {
    q.delete("access_token"); q.delete("token"); q.delete("jwt");
    q.delete("code"); q.delete("state"); q.delete("login");
    q.delete("error"); q.delete("error_description"); q.delete("message");
    const cleanUrl = `${url.pathname}${q.toString() ? "?" + q.toString() : ""}${url.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);
  } catch { /* noop */ }

  // Redirigir
  window.location.replace(to);
}
