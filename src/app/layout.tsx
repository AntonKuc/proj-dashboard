import type { Metadata } from "next";
import "./globals.css";
import SessionProviderClient from "@/components/SessionProviderClient";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Проекты - консолидированный дашборд",
  description: "Консолидированная отчётность по всем проектам",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <SessionProviderClient>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </SessionProviderClient>
      </body>
    </html>
  );
}
