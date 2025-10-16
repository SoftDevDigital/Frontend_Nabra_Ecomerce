"use client";

import dynamic from "next/dynamic";
import LazyWrapper from "./LazyWrapper";

// Lazy load del componente Featured con delay
const Featured = dynamic(() => import("../Featured/Featured"), {
  loading: () => (
    <div className="p-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
          ))}
        </div>
      </div>
    </div>
  ),
  ssr: false, // No renderizar en servidor para mejor performance
});

export default function LazyFeatured() {
  return (
    <LazyWrapper delay={100}>
      <Featured />
    </LazyWrapper>
  );
}

