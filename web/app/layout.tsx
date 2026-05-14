import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EthereumProvider } from "@/lib/ethereum";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eskrow",
  description: "Escrow para intercambio de tokens ERC20"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <EthereumProvider>{children}</EthereumProvider>
      </body>
    </html>
  );
}
