"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { deleteCustomer, getCustomer } from "@/api/customers";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCustomer(id)
      .then((data) => {
        if (!cancelled) setCustomer(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error desconocido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!customer) return;
    if (!confirm(`¿Eliminar el cliente "${customer.companyName}" (${customer.customerId})?`))
      return;
    try {
      await deleteCustomer(customer.customerId);
      router.push("/customers");
      router.refresh();
    } catch (e) {
      alert(`No se pudo eliminar: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/customers" />}
          >
            ← Volver al listado
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {customer?.companyName ?? "Detalle del cliente"}
          </h1>
        </div>
        {customer && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/customers/${customer.customerId}/edit`} />}
            >
              Editar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground">Cargando…</p>
      )}

      {error && !loading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {customer && !loading && !error && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border p-4 sm:grid-cols-2 sm:p-6">
          <DetailRow label="ID" value={customer.customerId} mono />
          <DetailRow label="Compañía" value={customer.companyName} />
          <DetailRow label="Contacto" value={customer.contactName} />
          <DetailRow label="Cargo" value={customer.contactTitle} />
          <DetailRow label="Dirección" value={customer.address} />
          <DetailRow label="Ciudad" value={customer.city} />
          <DetailRow label="Región" value={customer.region} />
          <DetailRow label="Código postal" value={customer.postalCode} />
          <DetailRow label="País" value={customer.country} />
          <DetailRow label="Teléfono" value={customer.phone} />
          <DetailRow label="Fax" value={customer.fax} />
        </dl>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm"}>
        {value && value.length > 0 ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
