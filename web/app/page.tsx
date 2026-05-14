import { AddToken } from "@/components/AddToken";
import { BalanceDebug } from "@/components/BalanceDebug";
import { ConnectButton } from "@/components/ConnectButton";
import { CreateOperation } from "@/components/CreateOperation";
import { OperationsList } from "@/components/OperationsList";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Eskrow</h1>
          <p className="mt-1 text-sm text-white/60">
            DApp de escrow para intercambio de tokens ERC20.
          </p>
        </div>
        <ConnectButton />
      </header>

      <div className="mt-8 grid gap-6">
        <Card title="Tokens permitidos">
          <AddToken />
        </Card>
        <Card title="Crear operación de swap">
          <CreateOperation />
        </Card>
        <Card title="Operaciones">
          <OperationsList />
        </Card>
        <Card title="Debug de balances">
          <BalanceDebug />
        </Card>
      </div>
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
