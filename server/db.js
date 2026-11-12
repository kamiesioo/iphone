// Base de datos SQLite (un solo archivo en DATA_DIR). Sin dependencias: usa node:sqlite.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { TIENDAS, PRODUCTOS_DEMO } from "./seed.js";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
export const UPLOADS = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "tienda.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 3000;

  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS productos (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    modelo    TEXT    NOT NULL,
    linea     TEXT    NOT NULL DEFAULT '',
    gb        INTEGER NOT NULL DEFAULT 0,
    color     TEXT    NOT NULL DEFAULT '',
    estado    TEXT    NOT NULL DEFAULT 'nuevo',
    bateria   INTEGER,
    precio    INTEGER NOT NULL,
    descuento INTEGER NOT NULL DEFAULT 0,
    stock     INTEGER NOT NULL DEFAULT 0,
    tono      TEXT    NOT NULL DEFAULT '#c9a98a',
    img       TEXT    NOT NULL DEFAULT '',
    activo    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo  TEXT    NOT NULL UNIQUE,
    fecha   TEXT    NOT NULL,
    estado  TEXT    NOT NULL DEFAULT 'pendiente',
    cliente TEXT    NOT NULL,
    items   TEXT    NOT NULL,
    total   INTEGER NOT NULL,
    mensaje TEXT    NOT NULL
  );
`);

/* ---------- utilidades ---------- */
export function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getKV(k) {
  const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k);
  return r ? JSON.parse(r.v) : null;
}
export function setKV(k, v) {
  db.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, JSON.stringify(v));
}

/* ---------- tienda ---------- */
export const getTienda = () => getKV("tienda");
export const setTienda = (t) => setKV("tienda", t);

/* ---------- productos ---------- */
const toProducto = (r) => (r ? { ...r, activo: !!r.activo } : null);

export function listProductos({ soloActivos = false } = {}) {
  const sql = `SELECT * FROM productos ${soloActivos ? "WHERE activo = 1" : ""} ORDER BY id`;
  return db.prepare(sql).all().map(toProducto);
}
export const getProducto = (id) => toProducto(db.prepare("SELECT * FROM productos WHERE id = ?").get(id));

const COLS = "modelo, linea, gb, color, estado, bateria, precio, descuento, stock, tono, img, activo";
const bind = (p) => ({
  modelo: p.modelo, linea: p.linea, gb: p.gb, color: p.color, estado: p.estado,
  bateria: p.bateria ?? null, precio: p.precio, descuento: p.descuento ?? 0, stock: p.stock,
  tono: p.tono, img: p.img ?? "", activo: p.activo === false ? 0 : 1,
});

export function insertProducto(p) {
  const r = db
    .prepare(`INSERT INTO productos (${COLS}) VALUES (:modelo, :linea, :gb, :color, :estado, :bateria, :precio, :descuento, :stock, :tono, :img, :activo)`)
    .run(bind(p));
  return getProducto(Number(r.lastInsertRowid));
}
export function updateProducto(id, p) {
  db.prepare(
    `UPDATE productos SET modelo=:modelo, linea=:linea, gb=:gb, color=:color, estado=:estado, bateria=:bateria,
       precio=:precio, descuento=:descuento, stock=:stock, tono=:tono, img=:img, activo=:activo WHERE id = :id`
  ).run({ ...bind(p), id });
  return getProducto(id);
}
export const deleteProducto = (id) => db.prepare("DELETE FROM productos WHERE id = ?").run(id).changes > 0;
export const imgEnUso = (img) => db.prepare("SELECT 1 FROM productos WHERE img = ? LIMIT 1").get(img) !== undefined;

/* ---------- pedidos ---------- */
export function listPedidos(limit = 300) {
  return db
    .prepare("SELECT * FROM pedidos ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map((r) => ({ ...r, cliente: JSON.parse(r.cliente), items: JSON.parse(r.items) }));
}

/* ---------- primer arranque ---------- */
if (!getTienda()) {
  const base = TIENDAS[process.env.TIENDA] || TIENDAS.demo;
  setTienda({
    ...base,
    // Promo de ejemplo: termina en 14 días. Se cambia desde /admin.
    hotSale: { titulo: "Hot Sale", hasta: new Date(Date.now() + 14 * 864e5).toISOString() },
  });
}
if (!getKV("seeded")) {
  if (process.env.SEED_PRODUCTOS !== "0") for (const p of PRODUCTOS_DEMO) insertProducto({ estado: "nuevo", ...p });
  setKV("seeded", true);
}
