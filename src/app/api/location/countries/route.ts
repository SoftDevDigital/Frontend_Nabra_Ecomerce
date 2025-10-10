import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const countries = [
    { code: "mx", name: "México", flag: "🇲🇽" },
    { code: "ar", name: "Argentina", flag: "🇦🇷" },
    { code: "co", name: "Colombia", flag: "🇨🇴" },
    { code: "pe", name: "Perú", flag: "🇵🇪" },
    { code: "cl", name: "Chile", flag: "🇨🇱" },
    { code: "br", name: "Brasil", flag: "🇧🇷" },
  ];

  return NextResponse.json({ success: true, countries });
}
