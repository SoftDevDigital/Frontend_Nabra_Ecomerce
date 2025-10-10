// src/app/auth/google/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseGoogleCallbackParams,
  exchangeCodeForToken,
  tryHydrateTokenFromServer,   // ✅ NUEVO
} from "@/lib/googleAuth";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Procesando autenticación con Google…");

  useEffect(() => {
    (async () => {
      try {
        const { token, code, finalRedirect } = parseGoogleCallbackParams();
        const callbackUrl = `${window.location.origin}/auth/google/callback`;

        let accessToken = token;

        if (!accessToken && code) {
          // Backend con Authorization Code: hago exchange
          accessToken = await exchangeCodeForToken(code, callbackUrl);
        }

        // ✅ NUEVO: si el backend no manda token en la URL (cookie-only), hidratar
        if (!accessToken) {
          accessToken = await tryHydrateTokenFromServer();
        }

        if (!accessToken) {
          throw new Error("No se recibió token de Google.");
        }

        // Persistir token como en tus flujos locales
        localStorage.setItem("nabra_token", accessToken);

        // Notificar a toda la app (Header, etc.)
        try {
          window.dispatchEvent(new CustomEvent("auth:login", { detail: { provider: "google" } }));
        } catch {}

        setMsg("¡Listo! Iniciaste sesión con Google.");

        // Limpiar parámetros feos de la URL antes de salir (opcional)
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete("code");
          u.searchParams.delete("state");
          u.searchParams.delete("login");
          u.searchParams.delete("token");
          u.searchParams.delete("access_token");
          window.history.replaceState({}, "", u.pathname);
        } catch {}

        router.replace(finalRedirect || "/");
      } catch (e: any) {
        setMsg(e?.message || "No se pudo completar el inicio con Google.");
        setTimeout(() => router.replace("/auth"), 1200);
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 520, margin: "64px auto", padding: 16, textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Autenticando…</h1>
      <p>{msg}</p>
    </main>
  );
}
