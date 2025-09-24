// src/app/api/location/details/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = (searchParams.get("placeId") ?? "").trim();

    if (!placeId) {
      return NextResponse.json(
        { success: false, message: "Missing required query param: placeId" },
        { status: 400 }
      );
    }

    const url = new URL("https://nominatim.openstreetmap.org/lookup");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("place_ids", placeId);

    const rsp = await fetch(url.toString(), {
      headers: {
        "User-Agent": "NabraApp/1.0 (contacto: hola@nabra.mx)",
        "Accept-Language": "es",
      },
      // cache: "no-store" // opcional
    });

    if (!rsp.ok) throw new Error(`Nominatim ${rsp.status}`);

    const arr = (await rsp.json()) as Array<{
      place_id: number | string;
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
      name?: string;
    }>;

    if (!arr || arr.length === 0) {
      return NextResponse.json(
        { success: false, message: "Place not found" },
        { status: 404 }
      );
    }

    const it = arr[0];
    const address = it.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      address.state_district ||
      address.borough ||
      address.suburb ||
      "";

    const state =
      address.state ||
      address.region ||
      address.state_district ||
      address.province ||
      "";

    const countryLong = address.country || "México";
    const countryCode = (address.country_code || "mx").toUpperCase();
    const postcode = address.postcode || "";

    const address_components = [
      countryLong && {
        long_name: countryLong,
        short_name: countryCode,
        types: ["country", "political"],
      },
      state && {
        long_name: state,
        short_name: state,
        types: ["administrative_area_level_1", "political"],
      },
      city && {
        long_name: city,
        short_name: city,
        types: ["locality", "political"],
      },
      postcode && {
        long_name: postcode,
        short_name: postcode,
        types: ["postal_code"],
      },
    ].filter(Boolean) as Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;

    const result = {
      place_id: String(it.place_id),
      formatted_address: it.display_name,
      address_components,
      geometry: {
        location: { lat: Number(it.lat), lng: Number(it.lon) },
      },
    };

    const drenvioAddress = {
      country: countryCode,
      postal_code: postcode,
      state,
      city,
      address: it.display_name,
    };

    return NextResponse.json({
      success: true,
      placeDetails: { result },
      drenvioAddress,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
