import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "mx").toLowerCase();

  const popularCities: Record<string, any[]> = {
    mx: [
      { name: "Ciudad de México", state: "CDMX", postalCode: "06000" },
      { name: "Guadalajara", state: "Jalisco", postalCode: "44100" },
      { name: "Monterrey", state: "Nuevo León", postalCode: "64000" },
      { name: "Puebla", state: "Puebla", postalCode: "72000" },
      { name: "Tijuana", state: "Baja California", postalCode: "22000" },
    ],
    ar: [
      { name: "Buenos Aires", state: "CABA", postalCode: "1000" },
      { name: "Córdoba", state: "Córdoba", postalCode: "5000" },
      { name: "Rosario", state: "Santa Fe", postalCode: "2000" },
      { name: "Mendoza", state: "Mendoza", postalCode: "5500" },
    ],
  };

  const cities = popularCities[country] || [];

  return NextResponse.json({
    success: true,
    cities,
    country: country.toUpperCase(),
  });
}
