"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/types";

type Mode = "create" | "edit";

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (customer: Customer) => Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
}

const EMPTY: Customer = {
  customerId: "",
  companyName: "",
  contactName: "",
  contactTitle: "",
  address: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
  fax: "",
};

const FIELDS: {
  name: keyof Customer;
  label: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}[] = [
  { name: "companyName", label: "Compañía", required: true, maxLength: 40 },
  { name: "contactName", label: "Contacto", maxLength: 30 },
  { name: "contactTitle", label: "Cargo", maxLength: 30 },
  { name: "address", label: "Dirección", maxLength: 60 },
  { name: "city", label: "Ciudad", maxLength: 15 },
  { name: "region", label: "Región", maxLength: 15 },
  { name: "postalCode", label: "Código postal", maxLength: 10 },
  { name: "country", label: "País", maxLength: 15 },
  { name: "phone", label: "Teléfono", maxLength: 24 },
  { name: "fax", label: "Fax", maxLength: 24 },
];

function normalize(c: Customer): Customer {
  const trimmedOrUndef = (v?: string) => {
    const t = (v ?? "").trim();
    return t === "" ? undefined : t;
  };
  return {
    customerId: c.customerId.trim().toUpperCase(),
    companyName: c.companyName.trim(),
    contactName: trimmedOrUndef(c.contactName),
    contactTitle: trimmedOrUndef(c.contactTitle),
    address: trimmedOrUndef(c.address),
    city: trimmedOrUndef(c.city),
    region: trimmedOrUndef(c.region),
    postalCode: trimmedOrUndef(c.postalCode),
    country: trimmedOrUndef(c.country),
    phone: trimmedOrUndef(c.phone),
    fax: trimmedOrUndef(c.fax),
  };
}

export function CustomerForm({
  initialData,
  onSubmit,
  submitLabel,
  onCancel,
}: CustomerFormProps) {
  const mode: Mode = initialData ? "edit" : "create";
  const [form, setForm] = useState<Customer>(initialData ?? EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Customer>(key: K, value: Customer[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(normalize(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="ID de cliente"
          required
          maxLength={5}
          placeholder="p. ej. ALFKI"
          value={form.customerId}
          onChange={(v) => update("customerId", v)}
          disabled={mode === "edit"}
          hint={
            mode === "edit"
              ? "El ID no se puede modificar."
              : "5 caracteres, en mayúsculas."
          }
        />
        {FIELDS.map((f) => (
          <Field
            key={f.name}
            label={f.label}
            required={f.required}
            maxLength={f.maxLength}
            placeholder={f.placeholder}
            value={(form[f.name] as string | undefined) ?? ""}
            onChange={(v) => update(f.name, v)}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Guardando…"
            : (submitLabel ?? (mode === "edit" ? "Guardar cambios" : "Crear cliente"))}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  maxLength,
  placeholder,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
