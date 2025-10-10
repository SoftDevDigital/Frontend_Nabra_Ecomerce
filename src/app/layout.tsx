// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBar from "./components/AnnouncementBar/AnnouncementBar";
import Header from "./components/Header/Header";
import WhatsAppFloat from "./components/WhatsAppFloat/WhatsAppFloat"; // 👈 IMPORTAR

export const metadata: Metadata = {
  title: "NABRA | Calzado",
  description: "Pasos que inspiran, zapatos que enamoran.",
  icons: { icon: "/logoNabra.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AnnouncementBar />
        <Header />
        {children}

        {/* 👇 Botón flotante global */}
        <WhatsAppFloat
          phone="523312442370"              // 👈 número en formato internacional (52 + 3312442370)
          message="¡Hola Nabra! Quisiera consultar por un producto."
          side="right"
          offset={16}
        />
      </body>
    </html>
  );
}
