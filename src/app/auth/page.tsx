// src/app/auth/page.tsx
"use client";
import { useState } from "react";
import styles from "./auth.module.css";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { startGoogleOAuth } from "@/lib/googleAuth"; // 👈 NUEVO

type LoginBody = { email: string; password: string };
type RegisterBody = {
  email: string; password: string; name: string;
  lastName?: string;
  street?: string; city?: string; zip?: string; country?: string;
};

export default function AuthPage() {
  const [tab, setTab] = useState<"login"|"register">("login");
  const [login, setLogin] = useState<LoginBody>({ email:"", password:"" });
  const [reg, setReg] = useState<RegisterBody>({
    email:"", password:"", name:"", lastName:"",
    street:"", city:"", zip:"", country:""
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const router = useRouter();

  const [protMsg, setProtMsg] = useState<string|null>(null);

  function splitFullName(full: string) {
    const parts = (full || "").trim().split(/\s+/);
    const firstName = (parts.shift() || "").trim();
    const lastName = (parts.join(" ") || "").trim();
    return { firstName, lastName };
  }
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
      router.replace("/");
    } catch (err:any) {
      setMsg(err.message || "Credenciales inválidas.");
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const fromSplit = splitFullName(reg.name);
      const firstName = reg.name?.trim() || fromSplit.firstName;
      const lastName = (reg.lastName?.trim() || fromSplit.lastName || "");

      const payload = {
        email: normalizeEmail(reg.email),
        password: (reg.password || "").trim(),
        firstName,
        lastName,
      };

      const j = await apiFetch<{success:boolean; data:{access_token:string}}>(
        "/auth/register",
        { method:"POST", body: JSON.stringify(payload) }
      );

      localStorage.setItem("nabra_token", j.data.access_token ?? "");
      setMsg("¡Cuenta creada!");
      setTab("login");
    } catch (err:any) {
      setMsg(err.message || "No pudimos registrar la cuenta.");
    } finally { setLoading(false); }
  }

  async function handleProtected() {
    setProtMsg(null);
    try {
      const r = await apiFetch<{success: boolean; data: { message: string }}>(
        "/auth/protected",
        { method: "GET" }
      );
      setProtMsg(r?.data?.message || "OK");
    } catch (err: any) {
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

        {/* 👇 NUEVO: botón Google arriba del formulario para ambos tabs */}
        {/* SOLO mostrar Google cuando el tab es "login" */}
{tab === "login" && (
  <div className={styles.socialRow}>
    <button
      type="button"
      className={styles.googleBtn}
      onClick={() => startGoogleOAuth("from-login")}
      aria-label="Continuar con Google"
    >
      <span className={styles.googleIcon} aria-hidden>
        {/* Logo Google multicolor (brand safe) */}
        <svg viewBox="0 0 48 48" width="20" height="20">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 31.9 29.2 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 5 28.9 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 19-8.9 19-20c0-1.3-.1-2.2-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16.4 19.1 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 5 28.9 3 24 3 16.5 3 9.9 7.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 43c5.1 0 9.8-1.9 13.3-5.1l-6.1-4.9C29 34.8 26.6 36 24 36c-5.1 0-9.4-3.1-11.2-7.6l-6.6 5.1C9.8 38.7 16.4 43 24 43z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3C34.6 31.9 30.7 36 24 36c-5.1 0-9.4-3.1-11.2-7.6l-6.6 5.1C9.8 38.7 16.4 43 24 43c8.4 0 19-5.7 19-20 0-1.3-.1-2.2-.4-3.5z"/>
        </svg>
      </span>
      <span className={styles.googleText}>Continuar con Google</span>
    </button>
  </div>
)}

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
                  autoComplete="given-name"
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

            <div className={styles.row2}>
              <label className={styles.field}>
                <span>Apellido</span>
                <input
                  value={reg.lastName ?? ""}
                  onChange={e=>setReg(s=>({...s, lastName:e.target.value}))}
                  autoComplete="family-name"
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

        <div className={styles.testBox} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={styles.ghostBtn ?? styles.primary}
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
