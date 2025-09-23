// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBar from "./components/AnnouncementBar/AnnouncementBar";
import Header from "./components/Header/Header";

export const metadata: Metadata = {
  title: "NABRA | Calzado",
  description: "Pasos que inspiran, zapatos que enamoran.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AnnouncementBar />
        <Header />
        {children}
      </body>
    </html>
  );
}
