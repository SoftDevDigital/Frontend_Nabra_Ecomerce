// src/app/api/location/format-address/route.ts
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const placeDetails = body?.placeDetails?.result;
    const contact = body?.contact || {};

    if (!placeDetails || !Array.isArray(placeDetails.address_components)) {
      return NextResponse.json(
        { success: false, message: "placeDetails.result.address_components es requerido" },
        { status: 400 }
      );
    }

    const comps: Array<{ long_name: string; short_name: string; types: string[] }> =
      placeDetails.address_components;

    const findType = (t: string) => comps.find(c => (c.types || []).includes(t));

    const country = findType("country")?.short_name || "";
    const state = findType("administrative_area_level_1")?.long_name || "";
    const city = findType("locality")?.long_name || "";
    const postal_code = findType("postal_code")?.long_name || "";

    const drenvioAddress = {
      country,
      postal_code,
      state,
      city,
      address: placeDetails.formatted_address || "",
      contact: {
        name: contact.name || "",
        phone: contact.phone || "",
        email: contact.email || "",
      },
    };

    const errors: string[] = [];
    if (!drenvioAddress.country) errors.push("country faltante");
    if (!drenvioAddress.city) errors.push("city faltante");
    if (!drenvioAddress.state) errors.push("state faltante");
    if (!drenvioAddress.postal_code) errors.push("postal_code faltante");

    const validation = { isValid: errors.length === 0, errors };

    return NextResponse.json({ success: true, drenvioAddress, validation });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
