import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const country = searchParams.get("country") || "mx";

  if (!q || q.length < 2) {
    return NextResponse.json(
      {
        success: false,
        options: [],
        message: "La búsqueda debe tener al menos 2 caracteres",
      },
      { status: 400 }
    );
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&countrycodes=${encodeURIComponent(
      country
    )}&format=json&addressdetails=1&limit=5`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "location-service/1.0" },
    });
    const data = await resp.json();

    const options = (data || []).map((d: any) => ({
      value: d.place_id,
      label: d.display_name.split(",")[0],
      placeId: d.place_id,
      address: d.display_name,
      coordinates: {
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      },
    }));

    return NextResponse.json({
      success: true,
      options,
      message: `Se encontraron ${options.length} ubicaciones`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, options: [], message: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
