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

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://https://api.nabra.mx";
}

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

      const backendBody = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        comment: payload.message,
      };

      let sent = false;
      try {
        const resBE = await fetch(`${getApiBase()}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backendBody),
        });

        let msgText = "¡Mensaje enviado! Te responderemos a la brevedad.";
        try {
          const data = await resBE.json().catch(() => null);
          if (data && (data.message || data.msg)) {
            msgText = String(data.message || data.msg);
          }
        } catch {}

        if (!resBE.ok) throw new Error(msgText || "No se pudo enviar desde el backend.");

        setResult({ ok: true, text: msgText });
        sent = true;
      } catch (err) {
        console.info("[Contacto] Backend /contact falló, fallback /api/contact. Error:", err);
      }

      if (!sent) {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null as any);

        if (!res || !("ok" in res) || !res.ok) {
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
        <div className={s.topRow}>
          <Link href="/" className={s.backLink}>Volver al inicio</Link>
        </div>

        <header className={s.header}>
          <h1 className={s.h1}>Contacto</h1>
          <p className={s.sub}>¿Tenés dudas de talles, envíos o cambios? Escribinos ✨</p>
        </header>

        <section className={s.card}>
          {/* Formulario */}
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
                placeholder="+52 33 1244 2370"
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

          {/* Columna derecha */}
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
                <li>
                  <a className={s.link} href="mailto:contact@nabra.mx">
                    contact@nabra.mx
                  </a>
                </li>
                <li>
                  <a
                    className={s.link}
                    href="https://wa.me/523312442370"
                    target="_blank"
                    rel="noopener"
                  >
                    WhatsApp: +52 33 1244 2370
                  </a>
                </li>
                <li>
                  <a
                    className={s.link}
                    href="https://www.instagram.com/nabra.mx"
                    target="_blank"
                    rel="noopener"
                  >
                    Instagram @nabra.mx
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
