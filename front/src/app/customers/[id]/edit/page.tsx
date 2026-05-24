"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { getCustomer, updateCustomer } from "@/api/customers";
import { CustomerForm } from "@/components/CustomerForm";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditCustomerPage({ params }: PageProps) {
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

  async function handleUpdate(updated: Customer) {
    await updateCustomer(id, updated);
    router.push(`/customers/${id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Editar cliente</h1>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/customers/${id}`} />}
        >
          ← Volver
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Cargando…</p>}

      {error && !loading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {customer && !loading && !error && (
        <CustomerForm
          initialData={customer}
          onSubmit={handleUpdate}
          onCancel={() => router.push(`/customers/${id}`)}
        />
      )}
    </div>
  );
}
