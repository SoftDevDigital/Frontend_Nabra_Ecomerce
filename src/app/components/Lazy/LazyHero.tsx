"use client";

import dynamic from "next/dynamic";
import LazyWrapper from "./LazyWrapper";

// Lazy load del Hero con skeleton optimizado
const Hero = dynamic(() => import("../Hero/Hero"), {
  loading: () => (
    <section className="relative h-screen bg-gray-100 flex items-center justify-center">
      <div className="animate-pulse">
        <div className="h-16 bg-gray-200 rounded w-96 mb-8"></div>
        <div className="h-12 bg-gray-200 rounded w-48 mx-auto"></div>
      </div>
    </section>
  ),
  ssr: true, // Hero debe renderizar en servidor para SEO
});

export default function LazyHero() {
  return (
    <LazyWrapper>
      <Hero />
    </LazyWrapper>
  );
}

