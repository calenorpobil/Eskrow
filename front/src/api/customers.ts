"use server";

import type { Customer, CustomerQueryParams } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL no está definida en .env");
}

// El backend Rocket espera los query params en snake_case.
const QUERY_PARAM_MAP: Record<keyof CustomerQueryParams, string> = {
  page: "page",
  perPage: "per_page",
  nameFilter: "name_filter",
  orderBy: "order_by",
  orderDirection: "order_direction",
};

function buildQueryString(params: CustomerQueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [
    keyof CustomerQueryParams,
    CustomerQueryParams[keyof CustomerQueryParams],
  ][]) {
    if (value === undefined || value === null || value === "") continue;
    search.set(QUERY_PARAM_MAP[key], String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function handle<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `${context} falló (${res.status} ${res.statusText})${body ? `: ${body}` : ""}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function getCustomers(
  params: CustomerQueryParams = {},
): Promise<Customer[]> {
  const res = await fetch(`${API_BASE_URL}/customers${buildQueryString(params)}`, {
    cache: "no-store",
  });
  return handle<Customer[]>(res, "getCustomers");
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await fetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  return handle<Customer>(res, `getCustomer(${id})`);
}

export async function createCustomer(customer: Customer): Promise<Customer> {
  const res = await fetch(`${API_BASE_URL}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  return handle<Customer>(res, "createCustomer");
}

export async function updateCustomer(
  id: string,
  customer: Customer,
): Promise<Customer> {
  const res = await fetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    },
  );
  return handle<Customer>(res, `updateCustomer(${id})`);
}

export async function deleteCustomer(id: string): Promise<number> {
  const res = await fetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return handle<number>(res, `deleteCustomer(${id})`);
}
