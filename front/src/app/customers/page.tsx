"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { deleteCustomer, getCustomers } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/types";

const PER_PAGE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [nameFilter, setNameFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers({
        page,
        perPage: PER_PAGE,
        nameFilter: nameFilter || undefined,
      });
      setCustomers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, nameFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setNameFilter(searchInput.trim());
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el cliente "${name}" (${id})?`)) return;
    try {
      await deleteCustomer(id);
      await loadCustomers();
    } catch (e) {
      alert(`No se pudo eliminar: ${e instanceof Error ? e.message : e}`);
    }
  }

  const isLastPage = customers.length < PER_PAGE;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <Button nativeButton={false} render={<Link href="/customers/new" />}>
          Nuevo cliente
        </Button>
      </div>

      <form
        onSubmit={handleSearch}
        className="mb-4 flex flex-col gap-2 sm:flex-row"
      >
        <Input
          placeholder="Buscar por nombre de compañía…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button type="submit">Buscar</Button>
          {nameFilter && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setNameFilter("");
                setPage(1);
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Compañía</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead className="hidden lg:table-cell">Ciudad</TableHead>
              <TableHead className="hidden lg:table-cell">País</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.customerId}>
                  <TableCell className="font-mono text-xs">{c.customerId}</TableCell>
                  <TableCell className="font-medium">{c.companyName}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.contactName ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.city ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.country ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/customers/${c.customerId}`} />}
                      >
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/customers/${c.customerId}/edit`} />}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(c.customerId, c.companyName)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Página {page} · {customers.length} resultados
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isLastPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente →
          </Button>
        </div>
      </div>
    </div>
  );
}
