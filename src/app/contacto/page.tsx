// src/app/contacto/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./Contact.module.css";

type Payload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

/* ⬇️⬇️⬇️ AGREGADO: helper para base de API del backend */
function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
}
/* ⬆️⬆️⬆️ */

export default function ContactoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; text: string }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    // validaciones mínimas en el cliente
    if (!name.trim() || !email.trim() || !message.trim()) {
      setResult({ ok: false, text: "Completá nombre, email y tu mensaje." });
      return;
    }

    setSending(true);
    try {
      const payload: Payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim(),
      };

      /* ⬇️⬇️⬇️ AGREGADO: intento directo al backend /contact con { comment } */
      const backendBody = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        comment: payload.message, // 👈 el backend espera "comment"
      };

      let sent = false;
      try {
        const resBE = await fetch(`${getApiBase()}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backendBody),
        });

        // intentamos parsear; si no hay JSON igual mostramos OK
        let msgText = "¡Mensaje enviado! Te responderemos a la brevedad.";
        try {
          const data = await resBE.json().catch(() => null);
          if (data && (data.message || data.msg)) {
            msgText = String(data.message || data.msg);
          }
        } catch {
          /* noop */
        }

        if (!resBE.ok) {
          // si el backend responde error, lo mostramos y caemos al fallback
          throw new Error(msgText || "No se pudo enviar desde el backend.");
        }

        setResult({ ok: true, text: msgText });
        sent = true;
      } catch (err) {
        // seguimos al fallback local si el BE no está disponible
        console.info("[Contacto] Backend /contact falló, usando fallback /api/contact. Error:", err);
      }
      /* ⬆️⬆️⬆️ FIN agregado backend */

      // Fallback a tu endpoint local (como lo tenías)
      if (!sent) {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null as any);

        if (!res || !("ok" in res) || !res.ok) {
          // fallback “optimista” para que el flujo no se rompa en local
          console.info("[Contacto] payload:", payload);
          setResult({ ok: true, text: "¡Mensaje enviado! Te responderemos a la brevedad." });
        } else {
          const txt = (await res.text()) || "¡Mensaje enviado! Te responderemos a la brevedad.";
          setResult({ ok: true, text: txt });
        }
      }

      setName(""); setEmail(""); setPhone(""); setMessage("");
    } catch (err) {
      setResult({ ok: false, text: "No se pudo enviar el mensaje. Intentá nuevamente." });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.container}>
        {/* breadcrumb / volver */}
        <div className={s.topRow}>
          <Link href="/" className={s.backLink}>Volver al inicio</Link>
        </div>

        {/* título + subtítulo */}
        <header className={s.header}>
          <h1 className={s.h1}>Contacto</h1>
          <p className={s.sub}>¿Tenés dudas de talles, envíos o cambios? Escribinos ✨</p>
        </header>

        <section className={s.card}>
          {/* columna izquierda: formulario */}
          <form className={s.form} onSubmit={handleSubmit} noValidate>
            <div className={s.row2}>
              <label className={s.label}>
                <span>Nombre</span>
                <input
                  className={s.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </label>

              <label className={s.label}>
                <span>Correo electrónico</span>
                <input
                  className={s.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </label>
            </div>

            <label className={s.label}>
              <span>Teléfono (opcional)</span>
              <input
                className={s.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 55 1234 5678"
              />
            </label>

            <label className={s.label}>
              <span>Mensaje</span>
              <textarea
                className={`${s.input} ${s.textarea}`}
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contanos en qué podemos ayudarte…"
                required
              />
            </label>

            <div className={s.actions}>
              <button
                className={`${s.btn} ${s.btnPrimary}`}
                type="submit"
                disabled={sending}
              >
                {sending ? "Enviando…" : "Enviar mensaje"}
              </button>

              {result && (
                <span className={result.ok ? s.msgOk : s.msgErr}>{result.text}</span>
              )}
            </div>
          </form>

          {/* columna derecha: info/CTA lateral */}
          <aside className={s.aside}>
            <div className={s.asideCard}>
              <h3 className={s.asideTitle}>Atención al cliente</h3>
              <ul className={s.list}>
                <li>Lunes a Viernes 9–18h</li>
                <li>Respuesta en menos de 24h</li>
                <li>Cambios y devoluciones simples</li>
              </ul>
              <a href="/catalogo" className={`${s.btn} ${s.btnGhost}`}>Ver catálogo</a>
            </div>

            <div className={s.asideCard}>
              <h3 className={s.asideTitle}>También podés</h3>
              <ul className={s.list}>
                <li><a className={s.link} href="mailto:hola@nabra.mx">hola@nabra.mx</a></li>
                <li><a className={s.link} href="https://wa.me/5215512345678" target="_blank">WhatsApp</a></li>
                <li><a className={s.link} href="https://instagram.com/" target="_blank">Instagram</a></li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
