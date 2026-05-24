#[macro_use]
extern crate rocket;

use std::fmt::Display;
use std::sync::{Mutex, MutexGuard};

use rocket::serde::json::Json;
use rocket::response::status::Custom;
use rocket::http::Status;
use rocket::{Config, State};
use rocket::http::Method;
use rusqlite::Connection;
use rusqlite::ffi::{SQLITE_CONSTRAINT_FOREIGNKEY, SQLITE_CONSTRAINT_PRIMARYKEY, SQLITE_CONSTRAINT_UNIQUE};
use rocket_cors::{AllowedHeaders, AllowedOrigins, CorsOptions};
use serde::{Deserialize, Serialize};

pub struct DbConn(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub customer_id: String,
    pub company_name: String,
    pub contact_name: Option<String>,
    pub contact_title: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub phone: Option<String>,
    pub fax: Option<String>,
}

type ApiError = Custom<String>;

fn err(status: Status, msg: impl Display) -> ApiError {
    Custom(status, msg.to_string())
}

fn internal(context: &str, e: impl Display) -> ApiError {
    err(Status::InternalServerError, format!("{context}: {e}"))
}

// Recupera el lock incluso si está envenenado (otro thread hizo panic mientras
// lo tenía). Para una BD en memoria/local es razonable seguir trabajando.
fn lock_db(db: &State<DbConn>) -> MutexGuard<'_, Connection> {
    match db.0.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    }
}

// Mapea los códigos de constraint de SQLite a status HTTP semánticos.
// - FK violada al borrar (cliente con pedidos): 409 Conflict.
// - PK o UNIQUE duplicado al insertar: 409 Conflict.
// - Resto: 500.
fn map_sqlite_error(context: &str, e: rusqlite::Error) -> ApiError {
    if let rusqlite::Error::SqliteFailure(info, _) = &e {
        match info.extended_code {
            SQLITE_CONSTRAINT_FOREIGNKEY => {
                return err(
                    Status::Conflict,
                    format!("{context}: existen registros relacionados que lo impiden."),
                );
            }
            SQLITE_CONSTRAINT_PRIMARYKEY | SQLITE_CONSTRAINT_UNIQUE => {
                return err(
                    Status::Conflict,
                    format!("{context}: ya existe un registro con esa clave."),
                );
            }
            _ => {}
        }
    }
    internal(context, e)
}

#[get("/")]
fn index(_db: &State<DbConn>) -> &'static str {
    "Hello from Rocket"
}

#[get("/customers?<page>&<per_page>&<name_filter>&<order_by>&<order_direction>")]
fn list_customers(
    page: Option<u32>,
    per_page: Option<u32>,
    name_filter: Option<String>,
    order_by: Option<String>,
    order_direction: Option<String>,
    db: &State<DbConn>,
) -> Result<Json<Vec<Customer>>, ApiError> {
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(10);
    let order_by = order_by.unwrap_or_else(|| "company_name".to_string());
    let order_direction = order_direction.unwrap_or_else(|| "asc".to_string());

    let offset = (page - 1) * per_page;

    // order_by viene en snake_case desde la API; lo traducimos a la columna real
    // de la BBDD. Whitelist obligatoria: order_by se interpola en el SQL y no se
    // puede bindear como parámetro, así que aceptar texto libre seria una
    // puerta abierta a SQL injection.
    let order_column = match order_by.as_str() {
        "customer_id" => "CustomerID",
        "company_name" => "CompanyName",
        "contact_name" => "ContactName",
        "city" => "City",
        "country" => "Country",
        _ => "CompanyName",
    };
    let order_dir = if order_direction.eq_ignore_ascii_case("desc") {
        "DESC"
    } else {
        "ASC"
    };

    let mut sql = String::from(
        "SELECT CustomerID, CompanyName, ContactName, ContactTitle, \
                Address, City, Region, PostalCode, Country, Phone, Fax \
         FROM customers",
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(filter) = name_filter.as_ref().filter(|s| !s.is_empty()) {
        sql.push_str(" WHERE company_name LIKE ?");
        params.push(Box::new(format!("%{}%", filter)));
    }

    sql.push_str(&format!(" ORDER BY {} {}", order_column, order_dir));
    sql.push_str(" LIMIT ? OFFSET ?");
    params.push(Box::new(per_page as i64));
    params.push(Box::new(offset as i64));

    let conn = lock_db(db);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| internal("Preparando consulta de clientes", e))?;

    let customers: Vec<Customer> = stmt
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            |row| {
                Ok(Customer {
                    customer_id: row.get(0)?,
                    company_name: row.get(1)?,
                    contact_name: row.get(2)?,
                    contact_title: row.get(3)?,
                    address: row.get(4)?,
                    city: row.get(5)?,
                    region: row.get(6)?,
                    postal_code: row.get(7)?,
                    country: row.get(8)?,
                    phone: row.get(9)?,
                    fax: row.get(10)?,
                })
            },
        )
        .map_err(|e| internal("Ejecutando consulta de clientes", e))?
        .filter_map(|r| r.ok()) // descarta filas con error en lugar de panic
        .collect();

    Ok(Json(customers))
}

#[get("/customers/<id>")]
fn get_customer(
    id: &str,
    db: &State<DbConn>,
) -> Result<Json<Customer>, ApiError> {
    let conn = lock_db(db);

    let mut stmt = conn
        .prepare(
            "SELECT CustomerID, CompanyName, ContactName, ContactTitle, \
                    Address, City, Region, PostalCode, Country, Phone, Fax \
             FROM customers WHERE CustomerID = ?1",
        )
        .map_err(|e| internal("Preparando consulta de cliente", e))?;

    let mut rows = stmt
        .query_map([id], |row| {
            Ok(Customer {
                customer_id: row.get(0)?,
                company_name: row.get(1)?,
                contact_name: row.get(2)?,
                contact_title: row.get(3)?,
                address: row.get(4)?,
                city: row.get(5)?,
                region: row.get(6)?,
                postal_code: row.get(7)?,
                country: row.get(8)?,
                phone: row.get(9)?,
                fax: row.get(10)?,
            })
        })
        .map_err(|e| internal("Ejecutando consulta de cliente", e))?;

    match rows.next() {
        Some(Ok(customer)) => Ok(Json(customer)),
        Some(Err(e)) => Err(internal("Leyendo cliente", e)),
        None => Err(err(Status::NotFound, format!("Cliente '{}' no encontrado", id))),
    }
}

#[post("/customers", data = "<customer>", format = "json")]
fn create_customer(
    customer: Json<Customer>,
    db: &State<DbConn>,
) -> Result<Json<Customer>, ApiError> {
    let conn = lock_db(db);

    conn.execute(
        "INSERT INTO customers (CustomerID, CompanyName, ContactName, ContactTitle, \
                                Address, City, Region, PostalCode, Country, Phone, Fax) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            customer.customer_id,
            customer.company_name,
            customer.contact_name,
            customer.contact_title,
            customer.address,
            customer.city,
            customer.region,
            customer.postal_code,
            customer.country,
            customer.phone,
            customer.fax,
        ],
    )
    .map_err(|e| map_sqlite_error("Creando cliente", e))?;

    Ok(Json(customer.into_inner()))
}

#[put("/customers/<id>", data = "<customer>", format = "json")]
fn update_customer(
    id: &str,
    customer: Json<Customer>,
    db: &State<DbConn>,
) -> Result<Json<Customer>, ApiError> {
    let conn = lock_db(db);

    let affected = conn
        .execute(
            "UPDATE customers SET \
                CompanyName = ?1, ContactName = ?2, ContactTitle = ?3, \
                Address = ?4, City = ?5, Region = ?6, PostalCode = ?7, \
                Country = ?8, Phone = ?9, Fax = ?10 \
             WHERE CustomerID = ?11",
            rusqlite::params![
                customer.company_name,
                customer.contact_name,
                customer.contact_title,
                customer.address,
                customer.city,
                customer.region,
                customer.postal_code,
                customer.country,
                customer.phone,
                customer.fax,
                id,
            ],
        )
        .map_err(|e| map_sqlite_error("Actualizando cliente", e))?;

    if affected == 0 {
        return Err(err(Status::NotFound, format!("Cliente '{}' no encontrado", id)));
    }

    Ok(Json(customer.into_inner()))
}

#[delete("/customers/<id>")]
fn delete_customer(
    id: &str,
    db: &State<DbConn>,
) -> Result<Json<usize>, ApiError> {
    let conn = lock_db(db);

    let affected = conn
        .execute("DELETE FROM customers WHERE CustomerID = ?1", [id])
        .map_err(|e| map_sqlite_error("Borrando cliente", e))?;

    if affected == 0 {
        return Err(err(Status::NotFound, format!("Cliente '{}' no encontrado", id)));
    }

    Ok(Json(affected))
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let config = Config {
        port: 8001,
        ..Config::debug_default()
    };

    let db_path = concat!(env!("CARGO_MANIFEST_DIR"), "/northwind.db");
    let conn = Connection::open(db_path).expect("No se pudo abrir northwind.db");

    // SQLite parsea las cláusulas FOREIGN KEY pero NO las valida salvo que se
    // active explícitamente por conexión. Sin esta PRAGMA, borrar un cliente
    // con pedidos asociados tendría éxito y dejaría filas huérfanas en
    // `orders`. Con ella activada, esos borrados fallan con
    // SQLITE_CONSTRAINT_FOREIGNKEY y los mapeamos a 409 Conflict.
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .expect("No se pudo activar foreign_keys");

    // CORS: solo es imprescindible si un NAVEGADOR llama directamente a esta
    // API desde otro origen (p. ej. http://localhost:3000 -> http://localhost:8001).
    // Si todas las llamadas las hace la parte server de Next.js (Server
    // Components, Route Handlers, server actions), la petición sale desde Node
    // y no hay política same-origin que aplicar: CORS no es necesario.
    //
    // Para desactivarlo: comenta la línea `.attach(cors)` de abajo (y, si
    // quieres, también este bloque y el `use rocket_cors::...`).
    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::some_exact(&[
            "http://localhost:3000",
        ]))
        .allowed_methods(
            [Method::Get, Method::Post, Method::Put, Method::Delete, Method::Options]
                .iter()
                .map(|m| m.to_owned().into())
                .collect(),
        )
        .allowed_headers(AllowedHeaders::some(&["Content-Type", "Authorization"]))
        .allow_credentials(true)
        .to_cors()
        .expect("Error construyendo CORS");

    let _rocket = rocket::custom(config)
        .manage(DbConn(Mutex::new(conn)))
        .attach(cors)
        .mount(
            "/",
            routes![
                index,
                list_customers,
                get_customer,
                create_customer,
                update_customer,
                delete_customer
            ],
        )
        .launch()
        .await?;

    Ok(())
}
