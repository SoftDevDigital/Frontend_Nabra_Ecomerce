// src/app/orders/[id]/page.tsx
import { redirect } from "next/navigation";

export default function Page({ params }: { params: { id: string } }) {
  redirect(`/pedidos/${params.id}`);
}
