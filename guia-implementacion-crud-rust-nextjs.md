# Guía de implementación: CRUD de clientes con Rust/Rocket + Next.js

Guía por fases para desarrollar, con ayuda de un agente de IA (Cursor, Claude Code, Copilot, etc.), una aplicación full-stack de gestión de clientes (CRUD) sobre la base de datos Northwind. Cada fase incluye su objetivo, las tecnologías implicadas y un **prompt listo para copiar y pegar** al agente.

> **Cómo usar esta guía:** sigue las fases en orden. Pega cada prompt al agente, revisa el código generado, compílalo/ejecútalo, corrige errores con el agente y solo entonces avanza a la siguiente fase. No pegues toda la guía de golpe: el desarrollo incremental produce mucho mejor resultado y te permite entender qué hace cada pieza.

---

## Stack tecnológico completo

### Backend (API REST)
- **Rust** (lenguaje) + **Cargo** (gestor de paquetes y build).
- **Rocket** — framework web.
- **SQLite** — base de datos en un único fichero (base de datos de ejemplo *Northwind*).
- **rusqlite** — driver/ORM ligero para SQLite desde Rust.
- **serde** + **serde_json** — serialización/deserialización JSON.
- **rocket_cors** (o configuración CORS equivalente) — peticiones cross-origin.
- **std::sync::Mutex** — acceso seguro y serializado a SQLite (no es multi-thread).

### Frontend
- **Next.js** (App Router) + **React**.
- **TypeScript** — tipado estático.
- **fetch** — comunicación HTTP con la API (la transcripción usa fetch; el README menciona axios: elige uno).
- **shadcn/ui** — librería de componentes UI (la transcripción usa shadcn; el README menciona Material-UI: elige una).
- **Tailwind CSS** — estilos (dependencia de shadcn/ui).
- **React hooks** (`useState`, `useEffect`, `useCallback`) — manejo de estado.

### Herramientas de desarrollo recomendadas
- Editor con IA: **Cursor**, **Claude Code** o similar.
- `cargo watch -x run` — recarga automática del backend al guardar.
- Cliente REST en ficheros `.http` (extensión REST Client de VS Code) o **Postman** para probar endpoints sin frontend.
- `git` para clonar la base de datos Northwind y versionar el proyecto.

### Arquitectura objetivo
```
Navegador
   │
   ▼
Frontend Next.js (componentes React, puerto 3000)
   │  (use server / funciones servidor de Next.js)
   ▼
Capa API de Next.js (back-to-back con fetch)
   │
   ▼
API REST Rust/Rocket (puerto 8001)
   │
   ▼
SQLite (northwind.db)
```

---

## Fase 0 — Preparación del entorno

**Objetivo:** tener instaladas todas las herramientas y la base de datos disponible.

**Tecnologías:** Rust/Cargo, Node.js, SQLite, git.

**Prompt:**
```
Necesito preparar el entorno de desarrollo para un proyecto full-stack con un
backend en Rust (framework Rocket) y un frontend en Next.js con TypeScript.

Indícame, para mi sistema operativo, los comandos exactos para:
1. Instalar Rust y Cargo (rustup) y verificar la versión.
2. Instalar cargo-watch para recarga automática.
3. Instalar Node.js LTS y verificar npm.
4. Comprobar que tengo SQLite disponible.

Además, dame la estructura de carpetas raíz que voy a usar: una carpeta "back"
para el proyecto Rust y una carpeta "front" para el proyecto Next.js. No generes
todavía código de la aplicación, solo el setup del entorno y la estructura.
```

**Acción manual adicional:** consigue el fichero `northwind.db` (base de datos SQLite de ejemplo Northwind, ampliamente disponible en repositorios públicos) y colócalo en la carpeta `back/`.

---

## Fase 1 — Esqueleto del backend Rocket

**Objetivo:** un servidor Rocket mínimo que arranca y responde a una ruta GET, escuchando en el puerto 8001.

**Tecnologías:** Rust, Rocket.

**Prompt:**
```
Dentro de la carpeta "back", crea un proyecto Rust nuevo con cargo (cargo new).
Configura un servidor web básico con el framework Rocket que:

- Tenga una función main decorada con #[rocket::main] (o #[launch]) que devuelva
  el Result adecuado.
- Monte sobre la ruta raíz "/" una ruta GET de prueba que devuelva un texto
  estático tipo "Hello from Rocket".
- Escuche en el puerto 8001 (no el 8000 por defecto), configurándolo
  explícitamente.

Añade a Cargo.toml las dependencias necesarias de Rocket. Explícame brevemente
qué hace la macro de Rocket y cómo se montan las rutas. Quiero poder arrancarlo
con: cargo watch -x run
```

**Comprobación:** abre `http://localhost:8001/` en el navegador y verifica la respuesta.

---

## Fase 2 — Modelo de datos y conexión a SQLite

**Objetivo:** definir la estructura `Customer` espejo de la tabla, abrir la conexión a Northwind y compartirla como estado global protegido por un Mutex.

**Tecnologías:** Rust, rusqlite, serde, Mutex, estado gestionado de Rocket.

**Prompt:**
```
Sobre el proyecto Rocket de la carpeta "back", quiero conectar a una base de
datos SQLite llamada northwind.db situada en la raíz del proyecto.

1. Añade a Cargo.toml: rusqlite, serde y serde_json (con las features que
   necesite Rocket para JSON).
2. Define una struct "Customer" que sea un espejo de la tabla "customers" de
   Northwind. Marca como no nulos los campos obligatorios (id de cliente y
   nombre de compañía) y como Option<...> el resto de campos. Derívala con
   Serialize, Deserialize y Debug.
3. En main, abre la conexión con rusqlite::Connection::open hacia northwind.db,
   usando unwrap para que el programa entre en pánico si falla la conexión
   (base de datos inexistente o corrupta).
4. Como SQLite no es multi-thread, envuelve la conexión en un Mutex y regístrala
   como estado gestionado de Rocket (.manage(...)), de modo que pueda inyectarse
   en cada endpoint.

Explícame por qué es necesario el Mutex y cómo se recupera el estado dentro de
una ruta. Compila para verificar que no hay errores.
```

**Comprobación:** `cargo run` arranca sin errores y la conexión se abre correctamente.

---

## Fase 3 — Endpoint GET por ID

**Objetivo:** recuperar un cliente concreto por su id, devolviendo JSON o un 404.

**Tecnologías:** Rust, Rocket (responders, status), rusqlite (`query_map`), serde_json.

**Prompt:**
```
Añade al backend un endpoint para obtener un cliente por su ID:

- Ruta: GET /customers/<id>
- Recibe el id como parámetro de la ruta y el estado con la conexión a la BD.
- Bloquea el Mutex de la conexión antes de consultar.
- Prepara una sentencia SQL con parámetro (?) para buscar por el id del cliente
  y usa query_map para construir un Customer a partir de la fila (row.get para
  cada campo).
- Si el registro existe, devuelve Json<Customer> envuelto en Ok.
- Si no existe, devuelve un error 404 usando rocket::response::status::NotFound.
- El tipo de retorno debe permitir devolver ambas cosas (un Result que sea o un
  Json<Customer> o un NotFound).

Usa unwrap/? donde corresponda y explícame la diferencia entre usar unwrap (que
provoca panic / error 500) y el operador ? (que propaga el error). Genera además
un fichero calls.http con una llamada de ejemplo a un id existente y a uno
inexistente para probarlo.
```

**Comprobación:** prueba con el fichero `.http` un id que exista (JSON) y uno que no (404).

---

## Fase 4 — Endpoints POST, PUT y DELETE

**Objetivo:** crear, actualizar y borrar clientes.

**Tecnologías:** Rust, Rocket (`Json` en el body, parámetros de ruta), rusqlite (`execute`).

**Prompt:**
```
Añade al backend tres endpoints sobre la entidad customers:

1. CREATE — POST /customers
   - Recibe en el body un Customer en formato JSON (data = "<customer>", format=json).
   - Ejecuta un INSERT INTO customers especificando TODAS las columnas y sus
     valores (para que no se rompa si se añade una columna nueva a la tabla).
   - Si va bien devuelve Json<Customer> con el cliente creado; si falla, un 500.

2. UPDATE — PUT /customers/<id>
   - Recibe el id por la ruta y un Customer en JSON en el body.
   - Ejecuta un UPDATE ... SET sobre todos los campos modificables WHERE el id
     del cliente = parámetro. El id NO se modifica (es inmutable).
   - Devuelve el Customer actualizado en JSON.

3. DELETE — DELETE /customers/<id>
   - Recibe el id por la ruta y ejecuta un DELETE.
   - Devuelve un Json<usize> (u otro número) con el número de registros borrados.

Decora cada función con la macro de Rocket correspondiente (post, put, delete).
Recuérdame que debo añadir estas funciones al .mount() de main. Amplía el
fichero calls.http con ejemplos de cada operación, incluyendo la línea en blanco
entre cabeceras y body y la cabecera Content-Type: application/json.
```

**Comprobación:** desde el `.http`/Postman crea, actualiza y borra un cliente y verifica las respuestas.

---

## Fase 5 — Endpoint de listado con paginación, filtro y ordenación

**Objetivo:** el endpoint más complejo: listar clientes con parámetros opcionales de query string.

**Tecnologías:** Rust, Rocket (query params `Option<T>`), rusqlite (query dinámica con `LIKE`, `LIMIT`, `OFFSET`, `query_map` + `collect`).

**Prompt:**
```
Añade al backend el endpoint de listado de clientes, que es el más complejo:

- Ruta: GET /customers con parámetros de query string, TODOS opcionales:
    page (número de página), per_page (registros por página),
    name_filter (parte del nombre de compañía), order_by (campo de ordenación),
    order_direction (asc/desc).
  Declara cada parámetro como Option<...> en la firma de la función.

- Valores por defecto con unwrap_or / unwrap_or_default:
    page = 1, per_page = 10, order_by = "company_name", order_direction = "asc".

- Calcula el offset como (page - 1) * per_page para el salto de registros.

- Construye la consulta SQL de forma dinámica en un String mutable y un vector
  mutable de parámetros:
    * Si name_filter tiene contenido, añade " WHERE company_name LIKE ?" y mete
      en el vector el patrón con un % delante y otro detrás (búsqueda por
      contenido, no por igualdad). Cuida el espacio en blanco antes de WHERE.
    * Añade ORDER BY <order_by> <order_direction>.
    * Añade LIMIT ? OFFSET ? con per_page y offset.

- Ejecuta la query con query_map pasándole el vector de parámetros como slice,
  transforma cada fila (row) en un Customer con un closure |row| { ... }, haz
  unwrap de cada registro y collect en un Vec<Customer>.

- Devuelve Json<Vec<Customer>>.

Explícame cómo funciona el patrón LIKE con %, y por qué construimos la query como
String mutable. Añade al calls.http ejemplos: sin parámetros, con paginación,
con name_filter y con ordenación.
```

**Comprobación:** prueba el listado sin parámetros (página 1, 10 registros), con paginación distinta, con filtro de nombre y con ordenación.

---

## Fase 6 — Activación de CORS

**Objetivo:** habilitar peticiones cross-origin (opcional según arquitectura).

**Tecnologías:** Rust, rocket_cors (o fairing CORS).

**Prompt:**
```
Añade soporte CORS al backend Rocket usando rocket_cors (o un fairing
equivalente), permitiendo peticiones desde el frontend. Adjunta el CORS al
servidor con .attach(...) en el build de main.

Nota importante: explícame por qué el CORS solo es estrictamente necesario
cuando un navegador llama directamente a la API. En esta arquitectura, si las
llamadas las hace la parte servidor de Next.js (back-to-back), el CORS no sería
imprescindible. Deja el código preparado pero coméntame cómo desactivarlo si no
lo necesito.
```

**Comprobación:** el servidor sigue arrancando correctamente con el CORS adjuntado.

---

## Fase 7 — Esqueleto del frontend Next.js

**Objetivo:** crear el proyecto Next.js con TypeScript, Tailwind y shadcn/ui, y definir los tipos.

**Tecnologías:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui.

**Prompt:**
```
En la carpeta "front", crea una aplicación Next.js con App Router y TypeScript.
Configura Tailwind CSS e inicializa shadcn/ui (o Material-UI si prefieres;
elige una y sé coherente).

Define en un fichero de tipos (por ejemplo src/types) las interfaces de
TypeScript:
- Customer: con el id de cliente y el nombre de compañía como obligatorios y el
  resto de campos opcionales.
- CustomerQueryParams: con TODOS los campos opcionales (page, perPage,
  nameFilter, orderBy, orderDirection), usados para construir las consultas.

Crea también un fichero .env.example (y .env) con la variable que apunte a la URL
base de la API de Rust: http://localhost:8001

No generes todavía las páginas ni las llamadas; solo el proyecto, la config y los
tipos. Indícame cómo arrancar el frontend en modo desarrollo (npm run dev) en el
puerto 3000.
```

**Comprobación:** `npm run dev` levanta la app en `http://localhost:3000`.

---

## Fase 8 — Capa de API (cliente del backend)

**Objetivo:** centralizar las llamadas al backend Rust en un módulo de funciones servidor.

**Tecnologías:** Next.js (`"use server"`), fetch, TypeScript.

**Prompt:**
```
Crea en el frontend un módulo de API (por ejemplo src/api/customers.ts) marcado
con "use server", que centralice todas las llamadas al backend de Rust usando
fetch. Usa la variable de entorno con la URL base de la API.

Implementa estas funciones tipadas con TypeScript:
- getCustomers(params: CustomerQueryParams): construye la query string
  recorriendo las entradas del objeto params (Object.entries) y añadiéndolas
  solo si tienen valor; hace GET a /customers; devuelve Customer[].
- getCustomer(id): GET a /customers/<id>; devuelve un Customer.
- createCustomer(customer): POST a /customers con headers
  Content-Type: application/json y body JSON.stringify(customer).
- updateCustomer(id, customer): PUT a /customers/<id> con body JSON.
- deleteCustomer(id): DELETE a /customers/<id>.

Maneja errores de respuesta y tipa correctamente los retornos. Explícame qué es
"use server" en Next.js y por qué conviene concentrar aquí las llamadas a la API.
```

**Comprobación:** importa temporalmente `getCustomers` en una página y verifica que devuelve datos del backend.

---

## Fase 9 — Listado de clientes (página principal del CRUD)

**Objetivo:** tabla de clientes con paginación, búsqueda, ordenación y botones de acción.

**Tecnologías:** React (`useState`, `useEffect`, `useCallback`), shadcn/ui, Next.js routing.

**Prompt:**
```
Crea la página de listado de clientes en el frontend (ruta /customers o la que
corresponda en el App Router). Requisitos:

- Estado con useState para: lista de customers, loading, page, nameFilter.
- Una función loadCustomers envuelta en useCallback que llame a getCustomers con
  page, perPage=10 y nameFilter, y actualice el estado. Ponla en las
  dependencias del useEffect correctamente para evitar el bucle infinito de
  renders (la función debe ir envuelta en useCallback y declararse antes del
  useEffect).
- Mostrar un indicador "Cargando..." mientras loading sea true.
- Una tabla (componentes de shadcn/ui) que recorra los customers (map) y muestre
  sus campos.
- Un buscador por nombre de compañía que actualice nameFilter (valora usar un
  botón o un onChange; coméntame el trade-off de que onChange dispare en cada
  tecleo).
- Controles de paginación (siguiente / anterior) que cambien page.
- Por cada fila, botones: Ver (navega a /customers/<id>), Editar
  (navega a /customers/<id>/edit) y Eliminar.
- El botón Eliminar pide confirmación (confirm), llama a deleteCustomer y
  recarga la lista.

Diseño responsive. Explícame cómo evitar el bucle infinito de useEffect con
useCallback.
```

**Comprobación:** se ve la lista paginada; la búsqueda filtra; eliminar pide confirmación y recarga.

---

## Fase 10 — Detalle, formulario reutilizable, alta y edición

**Objetivo:** ver el detalle de un cliente y un formulario reutilizado para crear y editar.

**Tecnologías:** React, Next.js (rutas dinámicas y params), shadcn/ui.

**Prompt:**
```
Completa el CRUD del frontend con estas páginas y componentes:

1. Componente reutilizable CustomerForm:
   - Recibe initialData (opcional) y una función onSubmit.
   - Mantiene el estado del formulario inicializándolo con initialData si llega,
     o vacío si no (se reutiliza tanto para alta como para edición).
   - Al enviar, llama a la función onSubmit que le pasen.

2. Página de detalle (ruta /customers/<id>):
   - Lee el id de los params, llama a getCustomer, muestra "Cargando..." hasta
     tener datos y luego presenta la información del cliente en una grid.
   - Incluye botones Editar y Eliminar.

3. Página de alta (ruta /customers/new):
   - Renderiza CustomerForm SIN initialData y le pasa createCustomer como
     onSubmit. Al guardar, redirige al listado.

4. Página de edición (ruta /customers/<id>/edit):
   - Lee el id de params, carga el customer con getCustomer y lo pasa como
     initialData a CustomerForm; le pasa updateCustomer como onSubmit.

Marca como "use client" los componentes que usen hooks/estado. Explícame por qué
el mismo CustomerForm sirve para alta y edición.
```

**Comprobación:** crear, ver detalle, editar y borrar funcionan de extremo a extremo contra el backend.

---

## Fase 11 — Layout, navegación y cabecera

**Objetivo:** estructura visual común con cabecera y navegación.

**Tecnologías:** Next.js (layout, `Link`), React, shadcn/ui.

**Prompt:**
```
Añade al frontend una cabecera reutilizable (componente Header) con el título
"Northwind" y un enlace (Link de Next.js) a la página principal / base de datos.
Colócala en el layout para que aparezca en todas las páginas. Asegúrate de
importar correctamente el componente Link de next/link. Mantén el diseño
responsive y coherente con shadcn/ui.
```

**Comprobación:** la cabecera aparece en todas las páginas y la navegación funciona.

---

## Fase 12 — Pruebas integradas, manejo de errores y retoques

**Objetivo:** validar el flujo completo y endurecer el manejo de errores.

**Tecnologías:** todo el stack.

**Prompt:**
```
Vamos a revisar el proyecto completo de extremo a extremo:

1. Manejo de errores: en el backend, asegúrate de que los fallos de BD devuelven
   500 de forma controlada. Detecta y comenta el caso de intentar borrar un
   cliente que tiene registros relacionados (ej. pedidos): explica por qué falla
   y cómo controlar ese error en lugar de provocar un panic.
2. En el frontend, maneja respuestas de error de la API (404, 500) mostrando
   mensajes al usuario en lugar de romper la página.
3. Verifica que el endpoint de listado responde bien sin parámetros (página 1,
   10 registros) y con todas las combinaciones de paginación, filtro y orden.
4. Revisa que no haya bucles infinitos de render por dependencias mal puestas en
   useEffect.

Dame una checklist final de pruebas manuales para confirmar que el CRUD completo
funciona.
```

---

## Fase 13 (opcional) — Extensión a otra entidad

**Objetivo:** consolidar replicando el patrón sobre otra tabla de Northwind.

**Tecnologías:** las mismas.

**Prompt:**
```
Quiero replicar todo este CRUD (backend Rust/Rocket + frontend Next.js) para
otra entidad de la base de datos Northwind, por ejemplo "products" (que tiene
campos numéricos como precio y unidades) o "orders" (que tiene fechas). Genera
la struct/tipo, los cinco endpoints (listado con paginación/filtro/orden,
get por id, create, update, delete) y las páginas del frontend siguiendo
exactamente el mismo patrón que usamos para customers. Advierte de las
diferencias de tipos de datos (fechas, numéricos) y cómo manejarlas en Rust y en
TypeScript.
```

---

## Consejos para trabajar con el agente de IA

- **Itera fase por fase.** Compila y prueba antes de avanzar. Un agente trabaja mejor sobre una base que funciona.
- **Pide explicaciones**, no solo código: entender `Option<T>`, `unwrap` vs `?`, `query_map`, `useCallback` o `"use server"` te ahorrará horas de depuración.
- **Aporta contexto del error completo** (mensaje del compilador de Rust o de la consola del navegador) cuando algo falle; el compilador de Rust suele indicar exactamente qué dependencia o tipo falta.
- **Decide pronto** entre fetch/axios y entre shadcn-ui/Material-UI, y sé coherente en todo el proyecto.
- **Usa ficheros `.http`** (o Postman) para probar el backend de forma aislada antes de conectar el frontend; depurar las dos capas a la vez es más difícil.
- **El CORS** solo es imprescindible si el navegador llama directamente a la API; con la arquitectura back-to-back de Next.js puedes prescindir de él.
