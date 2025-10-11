import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.nabra.mx";

export type Review = {
  _id: string;
  productId: string;
  userId: string;
  userName?: string;
  rating: number;
  comment?: string;
  isVerified?: boolean;
  photos?: string[];
  helpfulVotes?: number;
  totalVotes?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ReviewsListResponse = {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [star: string]: number };
  page: number;
  totalPages: number;
};

export async function fetchProductReviews(
  productId: string,
  q: { page?: number; limit?: number; rating?: number; sortBy?: string } = {}
) {
  const params = new URLSearchParams();
  if (q.page) params.set("page", String(q.page));
  if (q.limit) params.set("limit", String(q.limit));
  if (q.rating) params.set("rating", String(q.rating));
  if (q.sortBy) params.set("sortBy", q.sortBy);

  const url = `${API_BASE}/reviews/product/${productId}${params.toString() ? `?${params}` : ""}`;
  return apiFetch<ReviewsListResponse>(url, { method: "GET" });
}

export async function createReview(body: {
  productId: string;
  orderId: string;
  rating: number;
  comment?: string;
  photos?: string[];
}) {
  return apiFetch<Review>(`${API_BASE}/reviews`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateReview(id: string, body: { rating?: number; comment?: string }) {
  return apiFetch<Review>(`${API_BASE}/reviews/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteReview(id: string) {
  return apiFetch<{ message: string }>(`${API_BASE}/reviews/${id}`, { method: "DELETE" });
}

export async function likeReview(id: string, helpful: boolean) {
  return apiFetch<{ message: string; helpfulVotes: number; totalVotes: number }>(
    `${API_BASE}/reviews/${id}/like`,
    { method: "POST", body: JSON.stringify({ helpful }) }
  );
}
