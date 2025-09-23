// src/app/producto/[id]/page.tsx
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  [k: string]: any;
};

type ProductResponse =
  | { success: true; data: Product; message?: string }
  | { success: false; message: string };

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;

  let product: Product | null = null;
  let err: string | null = null;

  try {
    const res = await fetch(`${API_BASE}/products/${id}`, { cache: "no-store" });
    const json = (await res.json()) as ProductResponse;

    if (!res.ok || !("success" in json) || json.success !== true) {
      // Tu API: 404 => "Producto no encontrado"
      throw new Error(("message" in json && json.message) || "Producto no encontrado");
    }
    product = json.data;
  } catch (e: any) {
    err = e?.message || "Producto no encontrado";
  }

  if (err) {
    return (
      <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Producto</h1>
        <p style={{ color: "crimson" }}>{err}</p>
      </main>
    );
  }

  if (!product) return null;

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>{product.name}</h1>

      <section
        style={{
          display: "grid",
          gap: 10,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
        }}
      >
        <div><strong>ID:</strong> {product._id}</div>
        {typeof product.price !== "undefined" && (
          <div><strong>Precio:</strong> {product.price}</div>
        )}
        {product.category && <div><strong>Categoría:</strong> {product.category}</div>}
        {product.description && <p style={{ margin: 0 }}>{product.description}</p>}
      </section>
    </main>
  );
}
