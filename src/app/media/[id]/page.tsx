// src/app/media/[id]/page.tsx
import Image from "next/image";

type MediaDoc = {
  _id: string;
  url: string;
  fileName: string;
  type: "product" | "cover";
  mimeType: string;
  active: boolean;
};

type MediaResponse =
  | { success: true; data: MediaDoc; message?: string }
  | { success: false; message: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export default async function MediaDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;

  let data: MediaDoc | null = null;
  let err: string | null = null;

  try {
    const res = await fetch(`${API_BASE}/media/${id}`, { cache: "no-store" }); // público, sin token
    const json = (await res.json()) as MediaResponse;

    if (!res.ok || !("success" in json) || json.success !== true) {
      throw new Error(("message" in json && json.message) || "Archivo no encontrado");
    }
    data = json.data;
  } catch (e: any) {
    err = e?.message || "Archivo no encontrado";
  }

  if (err) {
    return (
      <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Media</h1>
        <p style={{ color: "crimson" }}>{err}</p>
      </main>
    );
  }

  if (!data) return null;

  const absUrl = `${API_BASE}/${data.url}`.replace(/([^:]\/)\/+/g, "$1");

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Media {data._id}</h1>

      <div
        style={{
          display: "grid",
          gap: 8,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
        }}
      >
        <div><strong>fileName:</strong> {data.fileName}</div>
        <div><strong>type:</strong> {data.type}</div>
        <div><strong>mimeType:</strong> {data.mimeType}</div>
        <div><strong>active:</strong> {String(data.active)}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong>url:</strong>
          <code style={{ background: "#f7f7f7", padding: "2px 6px", borderRadius: 6 }}>{data.url}</code>
        </div>

        {/* Vista previa si es imagen */}
        {/^image\//.test(data.mimeType) && (
          <div style={{ marginTop: 8 }}>
            {/* podés usar <img> si preferís no configurar dominios de next/image */}
            <img
              src={absUrl}
              alt={data.fileName}
              style={{ maxWidth: 420, borderRadius: 8, border: "1px solid #eee" }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
