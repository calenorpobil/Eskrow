"use client";

import { AddToken } from "@/components/AddToken";
import { AnvilBalances } from "@/components/AnvilBalances";
import { ConnectButton } from "@/components/ConnectButton";
import { CreateOperation } from "@/components/CreateOperation";
import { OperationsList } from "@/components/OperationsList";
import { useEthereum } from "@/lib/ethereum";

export default function HomePage() {
  const { account } = useEthereum();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Escrow DApp</h1>
          <p className="mt-1 text-sm text-white/60">
            DApp de escrow para intercambio de tokens ERC20.
          </p>
        </div>
        <ConnectButton />
      </header>

      <div className="flex-1">
        {!account ? (
          <section className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 shadow-xl backdrop-blur">
              <h2 className="text-2xl font-semibold text-white">Bienvenido a Escrow DApp</h2>
              <p className="mt-3 max-w-md text-sm text-white/60">
                Conecta tu wallet para empezar a operar: añade tokens permitidos,
                crea operaciones de swap y consulta balances on-chain.
              </p>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="flex flex-col gap-6">
              <Card title="Tokens permitidos">
                <AddToken />
              </Card>
              <Card title="Crear operación de swap">
                <CreateOperation />
              </Card>
            </div>
            <div>
              <Card title="Operaciones">
                <OperationsList />
              </Card>
            </div>
            <div>
              <AnvilBalances />
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 border-t border-white/10 pt-6 text-xs text-white/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-white/60">Escrow DApp</span>
          <span>Intercambio de tokens ERC20 mediante escrow.</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
