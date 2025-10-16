"use client";

import { SEOConfig, generateStructuredData } from "@/lib/seo";

interface StructuredDataProps {
  config: SEOConfig;
}

export default function StructuredData({ config }: StructuredDataProps) {
  const structuredData = generateStructuredData(config);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2),
      }}
    />
  );
}

