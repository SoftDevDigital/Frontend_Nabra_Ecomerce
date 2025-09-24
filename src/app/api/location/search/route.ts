// src/app/api/location/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: "Query must be at least 2 characters long",
          results: [],
        },
        { status: 400 }
      );
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "10");
    url.searchParams.set("countrycodes", "mx");
    url.searchParams.set("q", q);

    const rsp = await fetch(url.toString(), {
      headers: {
        "User-Agent": "NabraApp/1.0 (contacto: hola@nabra.mx)",
        "Accept-Language": "es",
      },
      // Nominatim tolera GET sin cache; si querés, podés cache: "no-store"
    });

    if (!rsp.ok) {
      throw new Error(`Nominatim ${rsp.status}`);
    }

    const data = (await rsp.json()) as Array<{
      place_id: number | string;
      display_name: string;
      lat: string;
      lon: string;
      name?: string;
    }>;

    const results = data.map((it) => ({
      place_id: String(it.place_id),
      formatted_address: it.display_name,
      name: it.name || it.display_name.split(",")[0].trim(),
      geometry: {
        location: {
          lat: Number(it.lat),
          lng: Number(it.lon),
        },
      },
    }));

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Unexpected error",
        results: [],
      },
      { status: 500 }
    );
  }
}
