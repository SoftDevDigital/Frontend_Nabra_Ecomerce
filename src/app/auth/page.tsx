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
        <div className={styles.socialRow} style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => startGoogleOAuth(tab === "login" ? "from-login" : "from-register")}
            aria-label="Continuar con Google"
          >
            <span className={styles.iconWrap} aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M21.35 11.1h-9.9v2.98h5.8c-.25 1.5-1.73 4.4-5.8 4.4-3.5 0-6.36-2.9-6.36-6.4s2.86-6.4 6.36-6.4c2 0 3.36.85 4.13 1.58l2.8-2.7C16.83 2.6 14.6 1.7 12.25 1.7 6.9 1.7 2.6 6 2.6 11.35s4.3 9.65 9.65 9.65c5.58 0 9.25-3.92 9.25-9.45 0-.64-.07-1.1-.15-1.45z" fill="currentColor"/>
              </svg>
            </span>
            Continuar con Google
          </button>
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
