// src/app/auth/page.tsx
"use client";
import { useState } from "react";
import styles from "./auth.module.css";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation"; // si ya lo agregaste para login, dejalo

type LoginBody = { email: string; password: string };
type RegisterBody = {
  email: string; password: string; name: string;
  lastName?: string;            // 👈 NUEVO: Apellido en el tipo
  street?: string; city?: string; zip?: string; country?: string;
};

export default function AuthPage() {
  const [tab, setTab] = useState<"login"|"register">("login");
  const [login, setLogin] = useState<LoginBody>({ email:"", password:"" });
  const [reg, setReg] = useState<RegisterBody>({
    email:"", password:"", name:"", lastName:"", // 👈 NUEVO en el estado
    street:"", city:"", zip:"", country:""
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const router = useRouter();

  // ⬅️ agregado: mensaje para la prueba de ruta protegida
  const [protMsg, setProtMsg] = useState<string|null>(null);

  // ⬇️ Helper: separa nombre completo en firstName/lastName
  function splitFullName(full: string) {
    const parts = (full || "").trim().split(/\s+/);
    const firstName = (parts.shift() || "").trim();
    const lastName = (parts.join(" ") || "").trim();
    return { firstName, lastName };
  }

  // ⬇️ NUEVO: normaliza email
  function normalizeEmail(email: string) {
    return (email || "").trim().toLowerCase();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const body = {
        email: normalizeEmail(login.email),
        password: (login.password || "").trim(),
      };
      const j = await apiFetch<{success:boolean; data:{access_token:string}}>(
        "/auth/login",
        { method:"POST", body: JSON.stringify(body) }
      );
      localStorage.setItem("nabra_token", j.data.access_token ?? "");
      setMsg("¡Bienvenida! Iniciaste sesión.");
      router.replace("/"); // redirige al inicio
    } catch (err:any) {
      setMsg(err.message || "Credenciales inválidas.");
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      // ⬇️ Construí EXACTAMENTE el payload que tu backend espera
      // Preferimos el apellido del campo explícito; si viene vacío, hacemos split de name.
      const fromSplit = splitFullName(reg.name);
      const firstName = reg.name?.trim() || fromSplit.firstName;
      const lastName = (reg.lastName?.trim() || fromSplit.lastName || "");

      const payload = {
        email: normalizeEmail(reg.email),
        password: (reg.password || "").trim(),
        firstName,
        lastName,
        // ⚠️ NO enviar street/city/zip/country porque tu backend los rechaza
      };

      const j = await apiFetch<{success:boolean; data:{access_token:string}}>(
        "/auth/register",
        { method:"POST", body: JSON.stringify(payload) }
      );

      localStorage.setItem("nabra_token", j.data.access_token ?? "");
      setMsg("¡Cuenta creada!");
      setTab("login");
      // Si querés loguearlo y llevarlo al inicio directamente, podés:
      // router.replace("/");
    } catch (err:any) {
      setMsg(err.message || "No pudimos registrar la cuenta.");
    } finally { setLoading(false); }
  }

  // ⬅️ agregado: prueba de la ruta protegida GET /auth/protected
  async function handleProtected() {
    setProtMsg(null);
    try {
      const r = await apiFetch<{success: boolean; data: { message: string }}>(
        "/auth/protected",
        { method: "GET" }
      );
      setProtMsg(r?.data?.message || "OK");
    } catch (err: any) {
      // si el backend devuelve 401 -> "No autenticado"
      setProtMsg(err.message || "No autenticado");
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==="login" ? styles.active : ""}`}
                  onClick={()=>setTab("login")}>Iniciar sesión</button>
          <button className={`${styles.tab} ${tab==="register" ? styles.active : ""}`}
                  onClick={()=>setTab("register")}>Crear cuenta</button>
        </div>

        {tab==="login" ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <label className={styles.field}>
              <span>Email</span>
              <input type="email" value={login.email}
                     onChange={e=>setLogin(s=>({...s, email:e.target.value}))}
                     autoComplete="email" required />
            </label>
            <label className={styles.field}>
              <span>Contraseña</span>
              <input type="password" minLength={6} value={login.password}
                     onChange={e=>setLogin(s=>({...s, password:e.target.value}))}
                     autoComplete="current-password" required />
            </label>
            {msg && <p className={styles.msg}>{msg}</p>}
            <button className={styles.primary} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleRegister}>
            <div className={styles.row2}>
              <label className={styles.field}>
                <span>Nombre</span>
                <input
                  value={reg.name}
                  onChange={e=>setReg(s=>({...s, name:e.target.value}))}
                  autoComplete="given-name"                 // 👈 nombre
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input type="email" value={reg.email}
                       onChange={e=>setReg(s=>({...s, email:e.target.value}))}
                       autoComplete="email" required />
              </label>
            </div>

            {/* 👇 NUEVO: fila para Apellido, con un spacer para mantener 2 columnas sin romper nada */}
            <div className={styles.row2}>
              <label className={styles.field}>
                <span>Apellido</span>
                <input
                  value={reg.lastName ?? ""}
                  onChange={e=>setReg(s=>({...s, lastName:e.target.value}))}
                  autoComplete="family-name"               // 👈 apellido
                  required
                />
              </label>
              <div className={styles.spacer} aria-hidden="true"></div>
            </div>

            <label className={styles.field}>
              <span>Contraseña</span>
              <input type="password" minLength={6} value={reg.password}
                     onChange={e=>setReg(s=>({...s, password:e.target.value}))}
                     autoComplete="new-password" required />
            </label>

            <div className={styles.row2}>
              <label className={styles.field}><span>Calle</span>
                <input value={reg.street} onChange={e=>setReg(s=>({...s, street:e.target.value}))}/>
              </label>
              <label className={styles.field}><span>Ciudad</span>
                <input value={reg.city} onChange={e=>setReg(s=>({...s, city:e.target.value}))}/>
              </label>
            </div>
            <div className={styles.row2}>
              <label className={styles.field}><span>Código postal</span>
                <input value={reg.zip} onChange={e=>setReg(s=>({...s, zip:e.target.value}))}/>
              </label>
              <label className={styles.field}><span>País</span>
                <input value={reg.country} onChange={e=>setReg(s=>({...s, country:e.target.value}))}/>
              </label>
            </div>
            {msg && <p className={styles.msg}>{msg}</p>}
            <button className={styles.primary} disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        )}

        {/* ⬅️ agregado: caja de prueba para la ruta protegida */}
        <div className={styles.testBox} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={styles.ghostBtn ?? styles.primary} // usa tu estilo disponible
            onClick={handleProtected}
          >
            Probar autenticación (GET /auth/protected)
          </button>
          {protMsg && <p className={styles.msg} style={{ marginTop: 8 }}>{protMsg}</p>}
        </div>
      </div>
    </main>
  );
}
