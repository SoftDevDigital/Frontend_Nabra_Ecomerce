import type { Metadata } from "next";

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: "website" | "article" | "product";
  price?: number;
  currency?: string;
  availability?: "in_stock" | "out_of_stock" | "preorder";
  brand?: string;
  category?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

const SITE_CONFIG = {
  name: "NABRA",
  description: "Pasos que inspiran, zapatos que enamoran. Calzado de calidad para la mujer moderna.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://nabra.com",
  image: "/logoNabra.png",
  twitter: "@nabra_calzado",
  locale: "es_MX",
  type: "website",
};

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image,
    url,
    type = "website",
    price,
    currency = "MXN",
    availability = "in_stock",
    brand = "NABRA",
    category = "Calzado",
    publishedTime,
    modifiedTime,
  } = config;

  const fullTitle = title.includes(SITE_CONFIG.name) ? title : `${title} | ${SITE_CONFIG.name}`;
  const fullDescription = description || SITE_CONFIG.description;
  const fullImage = image ? `${SITE_CONFIG.url}${image}` : `${SITE_CONFIG.url}${SITE_CONFIG.image}`;
  const fullUrl = url ? `${SITE_CONFIG.url}${url}` : SITE_CONFIG.url;

  const metadata: Metadata = {
    title: fullTitle,
    description: fullDescription,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    authors: [{ name: SITE_CONFIG.name }],
    creator: SITE_CONFIG.name,
    publisher: SITE_CONFIG.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      type,
      locale: SITE_CONFIG.locale,
      url: fullUrl,
      title: fullTitle,
      description: fullDescription,
      siteName: SITE_CONFIG.name,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      images: [fullImage],
      creator: SITE_CONFIG.twitter,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  };

  // Agregar metadatos específicos para productos
  if (type === "product" && price) {
    metadata.other = {
      ...metadata.other,
      "product:price:amount": price.toString(),
      "product:price:currency": currency,
      "product:availability": availability,
      "product:brand": brand,
      "product:category": category,
    };
  }

  // Agregar fechas de publicación/modificación
  if (publishedTime) {
    metadata.openGraph = {
      ...metadata.openGraph,
      publishedTime,
    };
  }
  if (modifiedTime) {
    metadata.openGraph = {
      ...metadata.openGraph,
      modifiedTime,
    };
  }

  return metadata;
}

export function generateStructuredData(config: SEOConfig) {
  const {
    title,
    description,
    image,
    url,
    type = "website",
    price,
    currency = "MXN",
    availability = "in_stock",
    brand = "NABRA",
    category = "Calzado",
    publishedTime,
    modifiedTime,
  } = config;

  const fullUrl = url ? `${SITE_CONFIG.url}${url}` : SITE_CONFIG.url;
  const fullImage = image ? `${SITE_CONFIG.url}${image}` : `${SITE_CONFIG.url}${SITE_CONFIG.image}`;

  const baseStructuredData = {
    "@context": "https://schema.org",
    "@type": type === "product" ? "Product" : "WebSite",
    name: title,
    description,
    url: fullUrl,
    image: fullImage,
    brand: {
      "@type": "Brand",
      name: brand,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_CONFIG.url}${SITE_CONFIG.image}`,
      },
    },
  };

  if (type === "product") {
    return {
      ...baseStructuredData,
      "@type": "Product",
      category,
      offers: {
        "@type": "Offer",
        price: price?.toString(),
        priceCurrency: currency,
        availability: `https://schema.org/${availability === "in_stock" ? "InStock" : "OutOfStock"}`,
        seller: {
          "@type": "Organization",
          name: SITE_CONFIG.name,
        },
      },
      ...(publishedTime && { datePublished: publishedTime }),
      ...(modifiedTime && { dateModified: modifiedTime }),
    };
  }

  if (type === "article") {
    return {
      ...baseStructuredData,
      "@type": "Article",
      headline: title,
      ...(publishedTime && { datePublished: publishedTime }),
      ...(modifiedTime && { dateModified: modifiedTime }),
    };
  }

  return {
    ...baseStructuredData,
    "@type": "WebSite",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_CONFIG.url}/buscar?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export const DEFAULT_SEO = {
  title: "NABRA | Calzado de Calidad para la Mujer Moderna",
  description: "Descubre nuestra colección de calzado elegante y cómodo. Zapatos que enamoran, pasos que inspiran. Envío gratis en compras mayores a $500.",
  keywords: [
    "zapatos mujer",
    "calzado elegante",
    "zapatos cómodos",
    "moda femenina",
    "zapatos online",
    "NABRA",
    "calzado de calidad",
    "zapatos trendy",
  ],
  image: "/logoNabra.png",
  url: "/",
};

