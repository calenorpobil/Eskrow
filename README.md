# Rust Telco Rocket — CRUD de clientes (Northwind)

Aplicación full-stack en construcción siguiendo la [guía de implementación por fases](guia-implementacion-crud-rust-nextjs.md).

Objetivo final: CRUD de clientes sobre la base de datos **Northwind**, con backend Rust/Rocket + SQLite y frontend Next.js + TypeScript.

---

## Stack

**Backend**
- Rust (edición 2021) + Cargo
- [Rocket](https://rocket.rs) 0.5.1 (feature `json`)
- SQLite (vía `rusqlite` 0.31, feature `bundled`)
- `serde` (feature `derive`) + `serde_json`

**Frontend**
- Next.js 16 (App Router, Turbopack) + React + TypeScript
- Tailwind CSS v4 (vía `@tailwindcss/postcss`)
- shadcn/ui (estilo `base-nova`, sobre `@base-ui/react`)
- `fetch` nativo + Server Functions (`"use server"`) para llamar al backend

**Entorno de desarrollo**
- WSL (Ubuntu) sobre Windows 10
- `cargo watch -x run` para recarga automática del backend

---

## Estado actual

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Preparación del entorno (Rust, cargo-watch, Node.js LTS, SQLite) | ✅ Completada |
| 1 | Esqueleto del backend Rocket en puerto 8001 | ✅ Completada |
| 2 | Modelo `Customer` + conexión SQLite + Mutex como estado gestionado | ✅ Completada |
| 3 | Endpoint `GET /customers/<id>` | ✅ Completada |
| 4 | Endpoints `POST`, `PUT`, `DELETE` | ✅ Completada |
| 5 | Listado con paginación, filtro y ordenación | ✅ Completada |
| 6 | CORS | ✅ Completada |
| 7 | Esqueleto del frontend Next.js | ✅ Completada |
| 8 | Capa de API (cliente del backend) | ✅ Completada |
| 9 | Página de listado | ✅ Completada |
| 10 | Detalle, alta y edición con formulario reutilizable | ⏳ Próxima |
| 11 | Layout y navegación | ⏸️ Pendiente |
| 12 | Pruebas integradas y manejo de errores | ⏸️ Pendiente |
| 13 | (Opcional) Extensión a otra entidad | ⏸️ Pendiente |

---

## Estructura de carpetas

Actualmente el proyecto vive en Windows (`C:\Users\Carlos\Documents\proyectos\CodeCrypto\Rust Telco Rocket\`) pero los procesos se ejecutan desde WSL/Debian (Node de Linux, `cargo` de Linux). Trabajar sobre `/mnt/c/...` es ~10× más lento que el filesystem nativo de Linux; en algún momento conviene mover el proyecto a `~/proyectos/...`.

```
Rust Telco Rocket/
├── guia-implementacion-crud-rust-nextjs.md
├── README.md
├── back/                          # Backend Rust + Rocket
│   ├── Cargo.toml
│   ├── src/main.rs                # Servidor Rocket en puerto 8001
│   ├── calls.http                 # Peticiones de ejemplo (REST Client)
│   └── northwind.db               # Base de datos SQLite (Northwind)
└── front/                         # Frontend Next.js 16
    ├── package.json
    ├── components.json            # Config de shadcn/ui
    ├── .env                       # NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
    └── src/
        ├── api/customers.ts       # Server Functions: getCustomers, get/create/update/deleteCustomer
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx           # (placeholder de create-next-app — pendiente)
        │   ├── globals.css
        │   └── customers/page.tsx # Listado con paginación, búsqueda y acciones
        ├── components/ui/         # button, input, table (shadcn)
        ├── lib/utils.ts
        └── types/customer.ts      # Customer, CustomerQueryParams (camelCase)
```

---

## Backend — estado actual (Fases 1-5 completadas)

### `back/Cargo.toml`
```toml
[package]
name = "back"
version = "0.1.0"
edition = "2021"

[dependencies]
rocket = { version = "0.5.1", features = ["json"] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### `back/src/main.rs`
- `#[rocket::main] async fn main() -> Result<(), rocket::Error>`
- Puerto **8001** configurado vía `Config { port: 8001, ..Config::debug_default() }`
- `struct Customer` espejo de la tabla `Customers` de Northwind (`customer_id` y `company_name` obligatorios; resto `Option<String>`), con `Serialize`, `Deserialize`, `Debug`
- Conexión SQLite abierta con `Connection::open(...)` sobre ruta absoluta vía `env!("CARGO_MANIFEST_DIR")` para ser independiente del `cwd`
- Conexión envuelta en `Mutex<Connection>` (newtype `DbConn`) y registrada con `.manage(...)` para inyectarla en cada handler como `&State<DbConn>`
- Endpoints:
  - `GET /` — saludo
  - `GET /customers` — listado con query params **opcionales**: `page` (def. 1), `per_page` (def. 10), `name_filter` (búsqueda `LIKE %x%` sobre `company_name`), `order_by` (def. `company_name`; whitelist: `customer_id`, `company_name`, `contact_name`, `city`, `country`), `order_direction` (def. `asc`). Devuelve `Json<Vec<Customer>>`. SQL construido dinámicamente sobre `String` mutable + `Vec<Box<dyn ToSql>>` y ejecutado con `params_from_iter`
  - `GET /customers/<id>` — devuelve `Result<Json<Customer>, NotFound<String>>`
  - `POST /customers` — `data = "<customer>", format = "json"`; `INSERT` con las 11 columnas; devuelve `Result<Json<Customer>, Custom<String>>` (500 en error)
  - `PUT /customers/<id>` — `UPDATE` de todos los campos modificables (el id es inmutable); devuelve el `Customer` recibido
  - `DELETE /customers/<id>` — devuelve `Json<usize>` con el número de filas borradas

### Cómo arrancar

Desde WSL:
```bash
cd ~/proyectos/rust-telco-rocket/back
cargo watch -x run
```

Comprobación rápida:
```bash
curl http://127.0.0.1:8001/                                            # Hello from Rocket
curl http://127.0.0.1:8001/customers/ALFKI                             # 200 + JSON
curl -i http://127.0.0.1:8001/customers/ZZZZZ                          # 404 Not Found
curl 'http://127.0.0.1:8001/customers'                                 # listado paginado (10 por página)
curl 'http://127.0.0.1:8001/customers?page=2&per_page=5'               # paginación
curl 'http://127.0.0.1:8001/customers?name_filter=rest'                # filtro por nombre
curl 'http://127.0.0.1:8001/customers?order_by=country&order_direction=desc'  # ordenación
curl -X POST http://127.0.0.1:8001/customers \
  -H 'Content-Type: application/json' \
  -d '{"customer_id":"TEST1","company_name":"Prueba","contact_name":null,"contact_title":null,"address":null,"city":null,"region":null,"postal_code":null,"country":null,"phone":null,"fax":null}'
curl -X PUT http://127.0.0.1:8001/customers/TEST1 \
  -H 'Content-Type: application/json' \
  -d '{"customer_id":"TEST1","company_name":"Prueba S.L.","contact_name":null,"contact_title":null,"address":null,"city":null,"region":null,"postal_code":null,"country":null,"phone":null,"fax":null}'
curl -X DELETE http://127.0.0.1:8001/customers/TEST1                   # devuelve 1
```

> **Nota — comillas obligatorias en bash** alrededor de URLs con `?` y `&`, o la shell pone el comando en background.

También puedes ejecutar las peticiones desde [back/calls.http](back/calls.http) con la extensión *REST Client* de VS Code.

---

## Frontend — estado actual (Fases 7-9 completadas)

### Stack instalado

- **Next.js 16.2.6** con App Router y Turbopack
- **React 19** + TypeScript estricto (paths `@/*` apuntando a `src/`)
- **Tailwind CSS v4** vía `@tailwindcss/postcss` (sin `tailwind.config.*`; tokens en `globals.css`)
- **shadcn/ui** estilo `base-nova` (componentes generados sobre `@base-ui/react`, no Radix). Componentes presentes: `button`, `input`, `table`
- **`.env`** con `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001`

### Fase 7 — Tipos y configuración

`src/types/customer.ts` define:
- `Customer` (`customerId`, `companyName` obligatorios; resto opcional). **camelCase** para alinear con la convención JS/TS.
- `OrderDirection` (`"asc" | "desc"`), `CustomerOrderBy` (whitelist literal de columnas válidas).
- `CustomerQueryParams` (todos opcionales: `page`, `perPage`, `nameFilter`, `orderBy`, `orderDirection`).

> **Cambio derivado en el backend:** el struct `Customer` lleva `#[serde(rename_all = "camelCase")]` para que el JSON casile con los tipos TS sin transformaciones manuales.

### Fase 8 — Capa de API (`src/api/customers.ts`)

Módulo con `"use server"` en la primera línea: **todas** las exports son Server Functions (solo corren en Node, nunca llegan al bundle del navegador; desde Client Components se invocan vía RPC interno por POST).

Funciones:
- `getCustomers(params: CustomerQueryParams = {})` → `Customer[]`
- `getCustomer(id: string)` → `Customer`
- `createCustomer(customer: Customer)` → `Customer`
- `updateCustomer(id: string, customer: Customer)` → `Customer`
- `deleteCustomer(id: string)` → `number` (filas borradas)

Detalles relevantes:
- **Traducción de naming** en la query string vía `QUERY_PARAM_MAP` (`perPage` → `per_page`, `nameFilter` → `name_filter`...). Sin esto los filtros se ignorarían silenciosamente porque Rocket declara los params en snake_case.
- **`cache: "no-store"`** en los GET — Next 16 cachea agresivamente y sin esto no verías los cambios tras una mutación.
- **Helper `handle<T>`** lanza `Error` con `status` + body cuando la respuesta no es 2xx.
- **Validación de `NEXT_PUBLIC_API_BASE_URL`** al cargar el módulo (falla rápido en lugar de hacer fetch a `undefined/customers`).
- **`encodeURIComponent(id)`** en las rutas con id, por higiene.

> **Aviso (Next 16 docs):** *Server Functions are reachable via direct POST requests, not just through your application's UI.* En este proyecto local sin auth da igual; en producción habría que validar la sesión dentro de cada función.

### Fase 9 — Página de listado (`src/app/customers/page.tsx`)

Client Component (`"use client"`) en la ruta `/customers`. Implementa:

- **Estado:** `customers`, `loading`, `error`, `page`, `nameFilter`, `searchInput` (controlado del input).
- **`loadCustomers` envuelta en `useCallback`** con dependencias `[page, nameFilter]`. Llama a `getCustomers({ page, perPage: 10, nameFilter: nameFilter || undefined })`.
- **`useEffect(() => { loadCustomers() }, [loadCustomers])`** — el patrón canónico para evitar el bucle infinito: la función se memoiza con `useCallback` y solo cambia cuando cambian *sus* dependencias, así que `useEffect` solo dispara cuando realmente hace falta recargar.
- **Búsqueda con `<form>` + botón "Buscar"** (no `onChange` por tecla): submit resetea `page = 1` y aplica el filtro. Hay botón "Limpiar" que aparece solo si hay filtro activo.
- **Tabla shadcn/ui (`Table`, `TableHeader`, etc.)** con columnas responsive: `ID`, `Compañía` siempre visibles; `Contacto` desde `md`; `Ciudad`/`País` desde `lg`; acciones siempre visibles.
- **Estados especiales:** "Cargando…" mientras `loading`, "Sin resultados." si la lista llega vacía, banner rojo si hay error.
- **Acciones por fila:** `Ver` (link a `/customers/<id>`), `Editar` (link a `/customers/<id>/edit`), `Eliminar` (con `confirm()` nativo). Los enlaces se componen con el `render` prop de Base UI: `<Button render={<Link href="..." />}>Texto</Button>`.
- **Paginación:** botones Anterior/Siguiente. `Anterior` deshabilitado en página 1; `Siguiente` deshabilitado si la página devolvió menos de `PER_PAGE` (heurística simple, ya que el backend no devuelve el total).

#### Trade-off documentado: ¿buscar al teclear o al hacer click?

- **`onChange` (en cada tecla)** — feedback instantáneo, pero **una petición por pulsación**: al escribir "restaurant" → 10 requests, 10 renders, 10 round-trips al backend. Requiere *debounce* (300-500 ms) con `setTimeout` + cleanup en `useEffect` para ser usable. Además complica la cancelación de peticiones obsoletas si el usuario sigue tecleando.
- **Botón "Buscar" (elegido aquí)** — UX un poco menos "mágica", pero **una petición por intento de búsqueda**, sin debounce, sin race conditions, sin throttle. Para datasets de cientos/miles de filas es lo más sensato. Si se quisiera onChange, lo correcto sería envolver el handler en un `useDeferredValue` o un debounce custom.

#### Por qué `useCallback` evita el bucle infinito

`useEffect(fn, [fn])` con `fn` declarada *dentro* del componente sin memoizar es un bucle: cada render crea una nueva referencia → `useEffect` detecta cambio → ejecuta `fn` → ese setState provoca render → nueva `fn` → loop.

`useCallback(fn, [deps])` devuelve la **misma referencia** entre renders mientras `deps` no cambien. Así `useEffect` solo re-ejecuta cuando cambia algo de `[page, nameFilter]`, no en cada render.

> Alternativa válida: meter el `fetch` directamente dentro del `useEffect` (sin función externa) y declarar `[page, nameFilter]` como deps. Sirve para casos pequeños; el patrón `useCallback` se justifica cuando varios handlers (botones, useEffect, child components) comparten la misma función.

### Cómo arrancar el frontend

Desde WSL (donde está el Node de Linux):
```bash
cd "/mnt/c/Users/Carlos/Documents/proyectos/CodeCrypto/Rust Telco Rocket/front"
npm run dev
# abre http://localhost:3000/customers
```

> ⚠️ La página raíz (`/`) sigue siendo el placeholder de `create-next-app`. La cabecera con navegación se añadirá en la Fase 11; mientras tanto, abre `/customers` directamente.

---

## Requisitos verificados en el entorno (Fase 0)

- `rustc` y `cargo` instalados vía `rustup` (con `build-essential`, `pkg-config`, `libssl-dev`)
- `cargo-watch` instalado globalmente
- Node.js LTS instalado vía `nvm`
- `sqlite3` y `libsqlite3-dev` disponibles en el sistema

---

## Decisiones de diseño relevantes

- **`order_by` / `order_direction` con whitelist.** SQLite no permite bindear identificadores (columnas) ni palabras clave (`ASC`/`DESC`) como parámetros `?`, así que se interpolan en el SQL con `format!`. Para evitar SQL injection, ambos pasan por un `match` que mapea valores conocidos a la columna real (`company_name` → `CompanyName`, etc.) y cae a un default seguro si llega cualquier otra cosa.
- **`LIKE %x%` para `name_filter`.** El patrón se construye en Rust (`format!("%{}%", filter)`) y se bindea como parámetro, no se concatena al SQL. Búsqueda por contenido, no por igualdad.
- **Lock del Mutex tolerante a envenenamiento** en `list_customers`: `match db.0.lock() { Ok(c) => c, Err(p) => p.into_inner() }`. Evita que un panic en un handler deje el servidor inservible para todos los requests siguientes. La iteración de filas usa `filter_map(|r| r.ok())` por la misma razón.
- **`format = "json"` en POST/PUT.** Rocket solo enruta la petición si el header `Content-Type: application/json` está presente; si falta, devuelve **404** (no 415). Detalle relevante para depurar peticiones de `curl`.

---

## Próximo paso

**Fase 10 — Detalle, alta y edición:** página de detalle (`/customers/<id>`), página de alta (`/customers/new`), página de edición (`/customers/<id>/edit`) y componente `CustomerForm` reutilizable entre alta y edición.

> Atención al cambio de Next 16: en rutas dinámicas, `params` es ahora `Promise<{ id: string }>`, hay que `await`earlo.

---

## Referencias

- Guía completa por fases: [guia-implementacion-crud-rust-nextjs.md](guia-implementacion-crud-rust-nextjs.md)
- [Rocket docs](https://rocket.rs/v0.5/guide/)
- [rusqlite docs](https://docs.rs/rusqlite)
- [Northwind para SQLite](https://github.com/jpwhite3/northwind-SQLite3)
