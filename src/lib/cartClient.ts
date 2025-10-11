// src/lib/cartClient.ts
import { apiFetch } from "./api";

export type AddToCartResponse = {
  message: string;
  cartItem: {
    _id: string;
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  };
  cartTotal: number;
};

export async function addToCart(input: {
  productId: string;
  quantity?: number;
  size?: string;
  color?: string;
}) {
  const payload: Record<string, any> = {
    productId: input.productId,
    quantity: Math.max(1, Number(input.quantity || 1)),
  };
  if (input.size?.trim()) payload.size = input.size.trim();
  if (input.color?.trim()) payload.color = input.color.trim();

  return apiFetch<AddToCartResponse | any>("/cart/add", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
