"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginAliasPage() {
  const router = useRouter();

  useEffect(() => {
    // Normaliza el query: si viene "...?error=foo?error=bar" -> "...?error=foo&error=bar"
    const href = window.location.href;
    const fixed = href.replace(/\?error=([^?]+)\?error=/, (_m, g1) => `?error=${encodeURIComponent(g1)}&error=`);

    const url = new URL(fixed);
    const q = url.searchParams;

    // Tomamos el error principal (si hay varios, me quedo con el primero no vacío)
    const err =
      q.getAll("error").find(Boolean) ||
      q.get("error_description") ||
      q.get("message") ||
      "auth_failed";

    // También preservo redirectTo si vino
    const redirectTo = q.get("redirectTo") || "/";

    // Redirijo al flujo real de la app (/auth) con el error y el destino original
    const to = new URL(`${window.location.origin}/auth`);
    to.searchParams.set("error", err);
    if (redirectTo) to.searchParams.set("redirectTo", redirectTo);

    // Limpio la URL actual y navego
    window.history.replaceState({}, "", "/login"); // evita dejar la query rota en el address bar
    router.replace(to.toString());
  }, [router]);

  return null;
}
