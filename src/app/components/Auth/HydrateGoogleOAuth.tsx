// src/app/components/Auth/HydrateGoogleOAuth.tsx
"use client";
import { useEffect } from "react";
import { consumeGoogleRedirect } from "@/lib/googleAuth";

export default function HydrateGoogleOAuth() {
  useEffect(() => {
    // Si la URL actual trae ?token&user&login=success, lo procesa y redirige.
    consumeGoogleRedirect({ onDoneRedirectTo: "/perfil" });
  }, []);
  return null;
}
