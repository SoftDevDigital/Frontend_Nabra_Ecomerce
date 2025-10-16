"use client";

import dynamic from "next/dynamic";
import LazyWrapper from "./LazyWrapper";

// Lazy load del Footer
const Footer = dynamic(() => import("../Footer/Footer"), {
  loading: () => (
    <div className="bg-gray-100 p-8">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-40"></div>
      </div>
    </div>
  ),
  ssr: false,
});

export default function LazyFooter() {
  return (
    <LazyWrapper delay={200}>
      <Footer />
    </LazyWrapper>
  );
}


