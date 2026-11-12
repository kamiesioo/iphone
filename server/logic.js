// Validación, pedidos y autenticación del admin.
import crypto from "node:crypto";
import { db, tx, getKV, setKV, getTienda, getProducto } from "./db.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

/* ---------- saneamiento ---------- */
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const int = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : def;
};
const HEX = /^#[0-9a-f]{6}$/i;
const IMG_OK = /^(\/uploads\/[a-f0-9]{16,}\.(jpg|png|webp)|https:\/\/[^\s"'<>]{1,280})$/i;

export const precioFinal = (p) => Math.round(p.precio * (1 - (p.descuento || 0) / 100));

export function validarProducto(b) {
  if (!b || typeof b !== "object") throw bad("Datos inválidos.");
  const modelo = clean(b.modelo, 80);
  if (!modelo) throw bad("Falta el modelo.");
  const precio = int(b.precio, 0, 100_000_000, 0);
  if (precio <= 0) throw bad("El precio debe ser mayor a 0.");
  const estado = b.estado === "usado" ? "usado" : "nuevo";
  const img = clean(b.img, 300);
  if (img && !IMG_OK.test(img)) throw bad("La imagen debe subirse desde el panel o ser un enlace https.");
  return {
    modelo,
    linea: clean(b.linea, 30),
    gb: int(b.gb, 0, 4096, 0),
    color: clean(b.color, 40),
    estado,
    bateria: estado === "usado" ? int(b.bateria, 1, 100, null) : null,
    precio,
    descuento: int(b.descuento, 0, 90, 0),
    stock: int(b.stock, 0, 9999, 0),
    tono: HEX.test(b.tono) ? b.tono : "#c9a98a",
    img,
    activo: b.activo !== false,
  };
}

// Acepta un link de Google Maps (…/@lat,lng,16z · …!3dlat!4dlng · …?q=lat,lng) o "lat, lng".
function parseMapa(texto) {
  const s = clean(texto, 600);
  if (!s) return null;
  const n = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const m =
    s.match(new RegExp(`!3d${n}!4d${n}`)) ||
    s.match(new RegExp(`@${n},${n}(?:,(\\d{1,2}(?:\\.\\d+)?)z)?`)) ||
    s.match(new RegExp(`[?&]q=${n},\\s*${n}`)) ||
    s.match(new RegExp(`^${n}\\s*,\\s*${n}$`));
  if (!m) throw bad("No pude leer la ubicación. Abrí el lugar en Google Maps y copiá el link completo de la barra de direcciones (los links cortos no sirven).");
  const lat = Number(m[1]), lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw bad("Las coordenadas de la ubicación no son válidas.");
  const zoom = Math.min(21, Math.max(3, Math.round(Number(m[3]) || 16)));
  return { lat, lng, zoom };
}

export function validarTienda(b, actual) {
  if (!b || typeof b !== "object") throw bad("Datos inválidos.");
  const nombre = clean(b.nombre, 60);
  if (!nombre) throw bad("Falta el nombre de la tienda.");
  const sv = b.servicios || {};
  const hasta = clean(b.hotSale?.hasta, 40);
  if (hasta && Number.isNaN(Date.parse(hasta))) throw bad("La fecha del Hot Sale no es válida.");
  return {
    nombre,
    eslogan: clean(b.eslogan, 160),
    ciudad: clean(b.ciudad, 60),
    whatsapp: String(b.whatsapp ?? "").replace(/\D/g, "").slice(0, 16),
    instagram: clean(b.instagram, 40).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, ""),
    horario: clean(b.horario, 100),
    direccion: clean(b.direccion, 140),
    mapa: b.mapaUrl === undefined ? actual.mapa ?? null : parseMapa(b.mapaUrl),
    sobre: clean(b.sobre, 400),
    acento: HEX.test(b.acento) ? b.acento : actual.acento,
    moneda: b.moneda === "ARS" ? "ARS" : "USD",
    servicios: {
      financiacion: !!sv.financiacion,
      usados: !!sv.usados,
      mayorista: !!sv.mayorista,
      accesorios: !!sv.accesorios,
    },
    hotSale: { titulo: clean(b.hotSale?.titulo, 40) || "Hot Sale", hasta: hasta ? new Date(hasta).toISOString() : "" },
  };
}

/* ---------- pedidos ---------- */
const money = (t, n) => `${t.moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR")}`;

export function metodosDePago(t) {
  return [
    ["efectivo", "Efectivo"],
    ["transferencia", "Transferencia"],
    t.servicios.financiacion && ["tarjeta", "Tarjeta / financiación"],
    t.servicios.usados && ["usado", "Parte de pago con mi usado"],
  ].filter(Boolean);
}

export function crearPedido(b) {
  if (!b || typeof b !== "object") throw bad("Datos inválidos.");
  const t = getTienda();

  // Items: se unifican repetidos y se limitan
  const pedidos = new Map();
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 40) : []) {
    const id = int(it?.id, 1, 1e9, 0), n = int(it?.n, 1, 999, 0);
    if (id && n) pedidos.set(id, (pedidos.get(id) || 0) + n);
  }
  if (!pedidos.size) throw bad("El carrito está vacío.");

  const nombre = clean(b.cliente?.nombre, 80);
  const telefono = clean(b.cliente?.telefono, 30);
  if (!nombre) throw bad("Completá tu nombre.");
  if (telefono.replace(/\D/g, "").length < 6) throw bad("Completá un teléfono válido.");

  const envio = b.entrega === "envio";
  const direccion = clean(b.direccion, 200);
  if (envio && !direccion) throw bad("Completá la dirección de envío.");

  const metodos = metodosDePago(t);
  const pago = metodos.find(([k]) => k === b.pago);
  if (!pago) throw bad("Elegí una forma de pago.");
  const usado = pago[0] === "usado" ? clean(b.usado, 200) : "";
  const notas = clean(b.notas, 300);

  return tx(() => {
    const items = [];
    const faltantes = [];
    for (const [id, n] of pedidos) {
      const p = getProducto(id);
      if (!p || !p.activo) { faltantes.push("un equipo que ya no está disponible"); continue; }
      if (p.stock < n) { faltantes.push(p.stock ? `${p.modelo} (quedan ${p.stock})` : `${p.modelo} (agotado)`); continue; }
      items.push({ id, modelo: p.modelo, gb: p.gb, color: p.color, estado: p.estado, precio: precioFinal(p), n });
    }
    if (faltantes.length) throw new HttpError(409, "Sin stock suficiente: " + faltantes.join(", ") + ".");

    const dec = db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?");
    for (const it of items) if (dec.run(it.n, it.id, it.n).changes !== 1) throw new HttpError(409, `Sin stock suficiente: ${it.modelo}.`);

    const total = items.reduce((a, i) => a + i.precio * i.n, 0);
    let codigo;
    do codigo = "P-" + crypto.randomBytes(4).toString("hex").slice(0, 5).toUpperCase();
    while (db.prepare("SELECT 1 FROM pedidos WHERE codigo = ?").get(codigo));

    const mensaje = [
      `Hola ${t.nombre}! Quiero confirmar este pedido (${codigo}):`,
      "",
      ...items.map((i) => `• ${i.n} x ${i.modelo} ${i.gb}GB ${i.color} (${i.estado}) — ${money(t, i.precio * i.n)}`),
      "",
      `Total: ${money(t, total)}`,
      `Entrega: ${envio ? "Envío a " + direccion : "Retiro en local"}`,
      `Pago: ${pago[1]}${usado ? " (" + usado + ")" : ""}`,
      "",
      `Nombre: ${nombre}`,
      `Teléfono: ${telefono}`,
      notas ? `Notas: ${notas}` : null,
    ].filter((l) => l !== null).join("\n");

    db.prepare("INSERT INTO pedidos (codigo, fecha, cliente, items, total, mensaje) VALUES (?, ?, ?, ?, ?, ?)").run(
      codigo,
      new Date().toISOString(),
      JSON.stringify({ nombre, telefono, entrega: envio ? "envio" : "retiro", direccion: envio ? direccion : "", pago: pago[1], usado, notas }),
      JSON.stringify(items),
      total,
      mensaje
    );
    return {
      codigo,
      total,
      mensaje,
      wa: t.whatsapp ? `https://wa.me/${t.whatsapp}?text=${encodeURIComponent(mensaje)}` : "",
    };
  });
}

export const ESTADOS_PEDIDO = ["pendiente", "confirmado", "entregado", "cancelado"];

// Cancelar devuelve el stock; reabrir un pedido cancelado lo vuelve a descontar.
export function cambiarEstadoPedido(id, estado) {
  if (!ESTADOS_PEDIDO.includes(estado)) throw bad("Estado inválido.");
  return tx(() => {
    const row = db.prepare("SELECT estado, items FROM pedidos WHERE id = ?").get(id);
    if (!row) throw new HttpError(404, "Pedido no encontrado.");
    const items = JSON.parse(row.items);
    if (row.estado !== "cancelado" && estado === "cancelado") {
      for (const it of items) db.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?").run(it.n, it.id);
    } else if (row.estado === "cancelado" && estado !== "cancelado") {
      for (const it of items) {
        if (db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?").run(it.n, it.id, it.n).changes !== 1)
          throw new HttpError(409, `No hay stock para reabrir el pedido (${it.modelo}).`);
      }
    }
    db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(estado, id);
  });
}

/* ---------- autenticación del admin ---------- */
let PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  PASSWORD = getKV("adminpw");
  if (!PASSWORD) {
    PASSWORD = crypto.randomBytes(9).toString("base64url");
    setKV("adminpw", PASSWORD);
    console.log(`[admin] No definiste ADMIN_PASSWORD. Contraseña generada: ${PASSWORD}`);
  }
}
let SECRET = getKV("secret");
if (!SECRET) setKV("secret", (SECRET = crypto.randomBytes(32).toString("hex")));

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
export const passwordOk = (p) => crypto.timingSafeEqual(sha(p), sha(PASSWORD));

const SESSION_MS = 12 * 3600 * 1000;
const firmar = (exp) => crypto.createHmac("sha256", SECRET).update(String(exp)).digest("base64url");
export const crearSesion = () => {
  const exp = Date.now() + SESSION_MS;
  return `${exp}.${firmar(exp)}`;
};
export const SESSION_SECONDS = SESSION_MS / 1000;
export function sesionValida(token) {
  const [exp, sig] = String(token || "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(firmar(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- límite de intentos (en memoria) ---------- */
export function limitador(max, ventanaMs) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.reset < now) hits.set(ip, (h = { n: 0, reset: now + ventanaMs }));
    if (++h.n > max) throw new HttpError(429, "Demasiados intentos. Probá de nuevo en unos minutos.");
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  };
}
