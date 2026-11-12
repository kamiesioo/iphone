/* Panel de administración: login, productos, pedidos y datos de la tienda. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let tienda = null;
let prods = [];
let pedidos = [];
const money = (n) => `${tienda?.moneda === "ARS" ? "$" : "US$"} ${Number(n).toLocaleString("es-AR")}`;
const precioFinal = (p) => Math.round(p.precio * (1 - (p.descuento || 0) / 100));

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

async function api(url, { method = "GET", body, raw, type } = {}) {
  const opts = { method, headers: {} };
  if (raw) { opts.body = raw; opts.headers["Content-Type"] = type; }
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith("/login")) { showLogin(); throw new Error(data.error || "Sesión vencida."); }
  if (!r.ok) throw new Error(data.error || "Algo salió mal.");
  return data;
}

/* ---------- ingreso ---------- */
function showLogin() {
  $("appView").hidden = true;
  $("loginView").hidden = false;
  $("pw").value = "";
  $("pw").focus();
}
async function showApp() {
  $("loginView").hidden = true;
  $("appView").hidden = false;
  await Promise.all([cargarTienda(), cargarProductos(), cargarPedidos()]);
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginErr").hidden = true;
  try {
    await api("/api/admin/login", { method: "POST", body: { password: $("pw").value } });
    await showApp();
  } catch (err) {
    $("loginErr").textContent = err.message;
    $("loginErr").hidden = false;
  }
});
$("logout").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" }).catch(() => {});
  showLogin();
});

/* ---------- pestañas ---------- */
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  document.querySelectorAll("#tabs .chip").forEach((c) => c.classList.toggle("on", c === b));
  for (const t of ["productos", "pedidos", "tienda"]) $("tab-" + t).hidden = t !== b.dataset.tab;
});

/* ---------- productos ---------- */
async function cargarProductos() {
  prods = await api("/api/admin/productos");
  renderProductos();
}
function art(p) {
  return p.img ? `<img class="photo" src="${esc(p.img)}" alt="">` : `<div class="mini" style="--tono:${esc(p.tono)};--w:26px"></div>`;
}
function renderProductos() {
  $("prodEmpty").hidden = prods.length > 0;
  $("prodRows").innerHTML = prods
    .map((p) => `<tr class="${p.activo ? "" : "off-row"}" data-id="${p.id}">
      <td><div class="thumb">${art(p)}</div></td>
      <td><strong>${esc(p.modelo)}</strong><small>${p.gb ? p.gb + " GB · " : ""}${esc(p.color)}${p.estado === "usado" && p.bateria ? " · Batería " + p.bateria + "%" : ""}</small></td>
      <td>${p.estado === "usado" ? "Usado" : "Nuevo"}</td>
      <td>${money(p.precio)}${p.descuento ? `<small>→ ${money(precioFinal(p))}</small>` : ""}</td>
      <td>${p.descuento || "—"}</td>
      <td><input type="number" min="0" max="9999" value="${p.stock}" data-stock="${p.id}" aria-label="Stock de ${esc(p.modelo)}"></td>
      <td><input type="checkbox" ${p.activo ? "checked" : ""} data-activo="${p.id}" aria-label="Visible"></td>
      <td class="acts"><button class="link" data-edit="${p.id}">Editar</button><button class="link" data-del="${p.id}">Eliminar</button></td>
    </tr>`)
    .join("");
}
async function guardarRapido(id, cambios) {
  const p = prods.find((x) => x.id === id);
  try {
    const nuevo = await api(`/api/admin/productos/${id}`, { method: "PUT", body: { ...p, ...cambios } });
    prods = prods.map((x) => (x.id === id ? nuevo : x));
    toast("Guardado");
  } catch (err) { toast(err.message); }
  renderProductos();
}
$("prodRows").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.stock) guardarRapido(Number(t.dataset.stock), { stock: Math.max(0, Number(t.value) || 0) });
  else if (t.dataset.activo) guardarRapido(Number(t.dataset.activo), { activo: t.checked });
});
$("prodRows").addEventListener("click", async (e) => {
  const t = e.target.closest("[data-edit],[data-del]");
  if (!t) return;
  if (t.dataset.edit) return abrirProducto(prods.find((p) => p.id === Number(t.dataset.edit)));
  const p = prods.find((x) => x.id === Number(t.dataset.del));
  if (!confirm(`¿Eliminar "${p.modelo}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/admin/productos/${p.id}`, { method: "DELETE" });
    prods = prods.filter((x) => x.id !== p.id);
    renderProductos();
    toast("Producto eliminado");
  } catch (err) { toast(err.message); }
});

/* formulario de producto */
const dlg = $("prodDialog");
let editando = null; // producto en edición o null si es nuevo
let imgActual = "";
const F = (k) => $("p-" + k);

function pintarFoto() {
  $("photoPrev").innerHTML = imgActual ? `<img src="${esc(imgActual)}" alt="">` : `<div class="mini" style="--tono:${esc(F("tono").value)}"></div>`;
  $("photoClear").hidden = !imgActual;
}
function abrirProducto(p) {
  editando = p || null;
  $("prodTitle").textContent = p ? "Editar producto" : "Nuevo producto";
  const d = p || { modelo: "", linea: "", gb: 128, color: "", estado: "nuevo", bateria: "", precio: "", descuento: 0, stock: 1, tono: "#c9a98a", img: "", activo: true };
  F("modelo").value = d.modelo; F("linea").value = d.linea; F("gb").value = d.gb || ""; F("color").value = d.color;
  F("estado").value = d.estado; F("bateria").value = d.bateria ?? ""; F("precio").value = d.precio;
  F("descuento").value = d.descuento; F("stock").value = d.stock; F("tono").value = d.tono; F("activo").checked = d.activo;
  imgActual = d.img || "";
  $("batField").hidden = d.estado !== "usado";
  $("prodErr").hidden = true;
  $("photoMsg").textContent = "JPG, PNG o WebP. Se optimiza sola.";
  pintarFoto();
  dlg.showModal();
}
$("newProd").addEventListener("click", () => abrirProducto(null));
$("prodCancel").addEventListener("click", () => dlg.close());
F("estado").addEventListener("change", () => { $("batField").hidden = F("estado").value !== "usado"; });
F("tono").addEventListener("input", () => { if (!imgActual) pintarFoto(); });
$("photoClear").addEventListener("click", () => { imgActual = ""; pintarFoto(); });

// La foto se reduce y se pasa a WebP en el navegador antes de subirla (ahorra espacio y acelera la tienda).
async function optimizar(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, "image/webp", 0.86));
  return blob && blob.type === "image/webp" ? blob : await new Promise((res) => c.toBlob(res, "image/png"));
}
$("p-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  $("photoMsg").textContent = "Subiendo…";
  try {
    const blob = await optimizar(file);
    const { url } = await api("/api/admin/upload", { method: "POST", raw: blob, type: blob.type });
    imgActual = url;
    $("photoMsg").textContent = "Foto lista.";
    pintarFoto();
  } catch (err) { $("photoMsg").textContent = err.message || "No se pudo subir la foto."; }
});

$("prodForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("prodErr").hidden = true;
  const body = {
    modelo: F("modelo").value, linea: F("linea").value, gb: F("gb").value, color: F("color").value, estado: F("estado").value,
    bateria: F("bateria").value, precio: F("precio").value, descuento: F("descuento").value, stock: F("stock").value,
    tono: F("tono").value, img: imgActual, activo: F("activo").checked,
  };
  $("prodSave").disabled = true;
  try {
    if (editando) {
      const p = await api(`/api/admin/productos/${editando.id}`, { method: "PUT", body });
      prods = prods.map((x) => (x.id === p.id ? p : x));
    } else {
      prods.push(await api("/api/admin/productos", { method: "POST", body }));
    }
    renderProductos();
    dlg.close();
    toast("Guardado");
  } catch (err) {
    $("prodErr").textContent = err.message;
    $("prodErr").hidden = false;
  } finally { $("prodSave").disabled = false; }
});

/* ---------- pedidos ---------- */
async function cargarPedidos() {
  pedidos = await api("/api/admin/pedidos");
  renderPedidos();
}
const fecha = (iso) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
function renderPedidos() {
  const pend = pedidos.filter((p) => p.estado === "pendiente").length;
  $("pendCount").hidden = pend === 0;
  $("pendCount").textContent = pend;
  $("orderEmpty").hidden = pedidos.length > 0;
  $("orderList").innerHTML = pedidos
    .map((o) => `<article class="order">
      <div class="order-head">
        <strong>${esc(o.codigo)}</strong>
        <span class="muted">${fecha(o.fecha)}</span>
        <span><strong>${money(o.total)}</strong></span>
        <select data-estado="${o.id}" class="st-${o.estado}" aria-label="Estado del pedido ${esc(o.codigo)}">
          ${["pendiente", "confirmado", "entregado", "cancelado"].map((s) => `<option value="${s}" ${s === o.estado ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}
        </select>
      </div>
      <ul>${o.items.map((i) => `<li>${i.n} × ${esc(i.modelo)} ${i.gb ? i.gb + " GB " : ""}${esc(i.color)} (${i.estado}) — ${money(i.precio * i.n)}</li>`).join("")}</ul>
      <div class="who"><strong>${esc(o.cliente.nombre)}</strong> · ${esc(o.cliente.telefono)} · ${o.cliente.entrega === "envio" ? "Envío a " + esc(o.cliente.direccion) : "Retiro en local"} · ${esc(o.cliente.pago)}${o.cliente.usado ? " (" + esc(o.cliente.usado) + ")" : ""}</div>
      ${o.cliente.notas ? `<div class="muted small">Notas: ${esc(o.cliente.notas)}</div>` : ""}
      <details><summary>Ver mensaje</summary><pre>${esc(o.mensaje)}</pre></details>
    </article>`)
    .join("");
}
$("orderList").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-estado]");
  if (!sel) return;
  try {
    await api(`/api/admin/pedidos/${sel.dataset.estado}`, { method: "PATCH", body: { estado: sel.value } });
    await Promise.all([cargarPedidos(), cargarProductos()]); // cancelar/reabrir cambia el stock
    toast("Estado actualizado");
  } catch (err) { toast(err.message); await cargarPedidos(); }
});

/* ---------- datos de la tienda ---------- */
const S = (k) => $("s-" + k);
const aLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
};
async function cargarTienda() {
  tienda = await api("/api/admin/tienda");
  $("admName").textContent = tienda.nombre;
  for (const k of ["nombre", "ciudad", "eslogan", "sobre", "whatsapp", "instagram", "direccion", "horario", "moneda", "acento"]) S(k).value = tienda[k] ?? "";
  for (const k of ["financiacion", "usados", "mayorista", "accesorios"]) $("sv-" + k).checked = !!tienda.servicios[k];
  S("mapa").value = tienda.mapa ? `https://www.google.com/maps/@${tienda.mapa.lat},${tienda.mapa.lng},${tienda.mapa.zoom}z` : "";
  S("hot-titulo").value = tienda.hotSale?.titulo || "";
  S("hot-hasta").value = aLocal(tienda.hotSale?.hasta);
}
$("storeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("storeErr").hidden = true;
  const body = { servicios: {}, hotSale: { titulo: S("hot-titulo").value, hasta: S("hot-hasta").value ? new Date(S("hot-hasta").value).toISOString() : "" } };
  for (const k of ["nombre", "ciudad", "eslogan", "sobre", "whatsapp", "instagram", "direccion", "horario", "moneda", "acento"]) body[k] = S(k).value;
  body.mapaUrl = S("mapa").value;
  for (const k of ["financiacion", "usados", "mayorista", "accesorios"]) body.servicios[k] = $("sv-" + k).checked;
  try {
    tienda = await api("/api/admin/tienda", { method: "PUT", body });
    $("admName").textContent = tienda.nombre;
    renderProductos();
    renderPedidos();
    toast("Cambios guardados");
  } catch (err) {
    $("storeErr").textContent = err.message;
    $("storeErr").hidden = false;
  }
});

/* ---------- arranque ---------- */
api("/api/admin/me").then(showApp).catch(showLogin);
