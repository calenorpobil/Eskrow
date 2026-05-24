"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createCustomer } from "@/api/customers";
import { CustomerForm } from "@/components/CustomerForm";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/types";

export default function NewCustomerPage() {
  const router = useRouter();

  async function handleCreate(customer: Customer) {
    await createCustomer(customer);
    router.push("/customers");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
        <Button variant="ghost" nativeButton={false} render={<Link href="/customers" />}>
          ← Volver
        </Button>
      </div>

      <CustomerForm
        onSubmit={handleCreate}
        onCancel={() => router.push("/customers")}
      />
    </div>
  );
}
