// Servidor HTTP sin dependencias: sirve el sitio (public/), la API y el panel /admin.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  db, DATA_DIR, UPLOADS, getTienda, setTienda, listProductos, getProducto,
  insertProducto, updateProducto, deleteProducto, imgEnUso, listPedidos,
} from "./db.js";
import {
  HttpError, validarProducto, validarTienda, crearPedido, cambiarEstadoPedido,
  passwordOk, crearSesion, sesionValida, SESSION_SECONDS, limitador,
} from "./logic.js";

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const PORT = Number(process.env.PORT) || 3000;
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
    "frame-src https://www.google.com https://maps.google.com; connect-src 'self'; object-src 'none'; " +
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

/* ---------- helpers ---------- */
const ipDe = (req) => (TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress || "?";

function json(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(data);
}

function leerBody(req, limite) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limite) { reject(new HttpError(413, "El contenido es demasiado grande.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function leerJSON(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/json")) throw new HttpError(415, "Se esperaba JSON.");
  const raw = await leerBody(req, 64 * 1024);
  try { return raw.length ? JSON.parse(raw.toString("utf8")) : {}; } catch { throw new HttpError(400, "JSON inválido."); }
}

const cookie = (req, name) => {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : "";
};
const esAdmin = (req) => sesionValida(cookie(req, "ks_admin"));
const cookieSegura = (req) => process.env.COOKIE_SECURE === "1" || req.headers["x-forwarded-proto"] === "https";

/* ---------- archivos estáticos ---------- */
function enviarArchivo(req, res, file, { inmutable = false, extra = {} } = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: "No encontrado" });
    const etag = `W/"${st.size}-${Math.trunc(st.mtimeMs)}"`;
    const headers = {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      ETag: etag,
      "Cache-Control": inmutable ? "public, max-age=2592000, immutable" : "no-cache",
      ...extra,
    };
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, { ...headers, "Content-Length": st.size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function estatico(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return json(res, 400, { error: "URL inválida" }); }
  if (rel.includes("\0") || rel.split("/").some((s) => s.startsWith("."))) return json(res, 404, { error: "No encontrado" });

  if (/^\/uploads\/[a-f0-9]{16,}\.(jpg|png|webp)$/.test(rel))
    return enviarArchivo(req, res, path.join(UPLOADS, path.basename(rel)), { inmutable: true });

  if (rel === "/") rel = "/index.html";
  let file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 404, { error: "No encontrado" });
  if (!path.extname(file)) file += ".html"; // URLs limpias: /catalogo -> catalogo.html
  const extra = path.basename(file) === "admin.html" ? { "X-Robots-Tag": "noindex, nofollow" } : {};
  enviarArchivo(req, res, file, { extra });
}

/* ---------- subida de fotos ---------- */
const FIRMAS = [
  ["image/jpeg", "jpg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", "png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", "webp", (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"],
];
async function subirImagen(req, res) {
  const tipo = (req.headers["content-type"] || "").split(";")[0];
  const f = FIRMAS.find(([t]) => t === tipo);
  if (!f) throw new HttpError(415, "Formato no permitido (JPG, PNG o WebP).");
  const buf = await leerBody(req, 4 * 1024 * 1024);
  if (buf.length < 100 || !f[2](buf)) throw new HttpError(400, "El archivo no es una imagen válida.");
  const name = crypto.randomBytes(12).toString("hex") + "." + f[1];
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  json(res, 201, { url: "/uploads/" + name });
}
function borrarImagenSiSobra(img) {
  if (img?.startsWith("/uploads/") && !imgEnUso(img)) fs.rm(path.join(UPLOADS, path.basename(img)), { force: true }, () => {});
}

/* ---------- API ---------- */
const limLogin = limitador(8, 10 * 60 * 1000);
const limPedidos = limitador(15, 60 * 60 * 1000);

async function api(req, res, pathname) {
  const m = req.method;
  let r;

  // Público
  if (m === "GET" && pathname === "/api/tienda") {
    return json(res, 200, { tienda: getTienda(), productos: listProductos({ soloActivos: true }), ahora: Date.now() });
  }
  if (m === "POST" && pathname === "/api/pedidos") {
    limPedidos(ipDe(req));
    return json(res, 201, crearPedido(await leerJSON(req)));
  }

  // Login / sesión
  if (m === "POST" && pathname === "/api/admin/login") {
    limLogin(ipDe(req));
    const { password } = await leerJSON(req);
    if (!passwordOk(password ?? "")) throw new HttpError(401, "Contraseña incorrecta.");
    const c = `ks_admin=${crearSesion()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${cookieSegura(req) ? "; Secure" : ""}`;
    return json(res, 200, { ok: true }, { "Set-Cookie": c });
  }
  if (m === "POST" && pathname === "/api/admin/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": "ks_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }

  // Todo lo demás requiere sesión
  if (!pathname.startsWith("/api/admin/")) throw new HttpError(404, "No encontrado");
  if (!esAdmin(req)) throw new HttpError(401, "Sesión vencida. Volvé a ingresar.");

  if (m === "GET" && pathname === "/api/admin/me") return json(res, 200, { ok: true });
  if (m === "GET" && pathname === "/api/admin/tienda") return json(res, 200, getTienda());
  if (m === "PUT" && pathname === "/api/admin/tienda") {
    const t = validarTienda(await leerJSON(req), getTienda());
    setTienda(t);
    return json(res, 200, t);
  }
  if (m === "GET" && pathname === "/api/admin/productos") return json(res, 200, listProductos());
  if (m === "POST" && pathname === "/api/admin/productos") {
    return json(res, 201, insertProducto(validarProducto(await leerJSON(req))));
  }
  if ((r = pathname.match(/^\/api\/admin\/productos\/(\d+)$/))) {
    const id = Number(r[1]);
    const actual = getProducto(id);
    if (!actual) throw new HttpError(404, "Producto no encontrado.");
    if (m === "PUT") {
      const p = updateProducto(id, validarProducto(await leerJSON(req)));
      if (actual.img !== p.img) borrarImagenSiSobra(actual.img);
      return json(res, 200, p);
    }
    if (m === "DELETE") {
      deleteProducto(id);
      borrarImagenSiSobra(actual.img);
      return json(res, 200, { ok: true });
    }
  }
  if (m === "GET" && pathname === "/api/admin/pedidos") return json(res, 200, listPedidos());
  if (m === "PATCH" && (r = pathname.match(/^\/api\/admin\/pedidos\/(\d+)$/))) {
    cambiarEstadoPedido(Number(r[1]), (await leerJSON(req)).estado);
    return json(res, 200, { ok: true });
  }
  if (m === "POST" && pathname === "/api/admin/upload") return subirImagen(req, res);

  // Respaldo consistente de la base (VACUUM INTO genera una copia sin tocar la original)
  if (m === "GET" && pathname === "/api/admin/respaldo") {
    const tmp = path.join(os.tmpdir(), `respaldo-${crypto.randomBytes(6).toString("hex")}.db`);
    db.exec(`VACUUM INTO '${tmp}'`);
    const fecha = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="tienda-${fecha}.db"`,
      "Cache-Control": "no-store",
    });
    const s = fs.createReadStream(tmp);
    s.pipe(res);
    s.on("close", () => fs.rm(tmp, { force: true }, () => {}));
    return;
  }

  throw new HttpError(404, "No encontrado");
}

/* ---------- servidor ---------- */
const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  const { pathname } = new URL(req.url, "http://x");
  try {
    if (pathname === "/healthz") return json(res, 200, { ok: true });
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Método no permitido");
    estatico(req, res, pathname);
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message });
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "Error interno." });
  }
});
server.requestTimeout = 30_000;
server.listen(PORT, "0.0.0.0", () => console.log(`Tienda lista en http://localhost:${PORT} · datos en ${DATA_DIR}`));

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
}
