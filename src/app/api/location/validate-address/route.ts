import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, postal_code, state, city, address, contact } = body;

    const errors: string[] = [];

    if (!country) errors.push("País es requerido");
    if (!postal_code || String(postal_code).length < 5) {
      errors.push("Código postal es requerido y debe tener al menos 5 dígitos");
    }
    if (!state) errors.push("Estado es requerido");
    if (!city) errors.push("Ciudad es requerida");
    if (!address) errors.push("Dirección es requerida");

    const validation = { isValid: errors.length === 0, errors };

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: true,
          validation,
          address: { country, postal_code, state, city, address, contact },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      validation,
      address: { country, postal_code, state, city, address, contact },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
