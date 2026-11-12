/* Código compartido por todas las páginas: datos de la tienda, carrito,
   tarjetas de producto, cabecera/pie y animaciones. */

export const $ = (id) => document.getElementById(id);
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- iconos (SVG de línea, sin emojis) ---------- */
const ICONS = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
  swap: '<path d="M4 8h14l-3-3.5M20 16H6l3 3.5"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="2"/><rect x="17" y="14" width="4" height="6" rx="2"/>',
  bag: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".7" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export function icon(name, size = 24) {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
// <i data-ic="clock" data-size="22"></i> en el HTML estático -> svg
export function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-ic]").forEach((el) => el.replaceWith(Object.assign(document.createElement("span"), { innerHTML: icon(el.dataset.ic, Number(el.dataset.size) || 24) }).firstChild));
}

/* ---------- datos ---------- */
let data;
try {
  const r = await fetch("/api/tienda");
  if (!r.ok) throw new Error();
  data = await r.json();
} catch {
  document.documentElement.classList.remove("loading");
  document.body.innerHTML = '<p class="boot-error">No pudimos cargar la tienda. Revisá tu conexión e intentá de nuevo.</p>';
  throw new Error("sin datos");
}
export const tienda = data.tienda;
export const PRODUCTOS = data.productos;
const skew = data.ahora - Date.now();
export const ahora = () => Date.now() + skew; // hora del servidor (la cuenta regresiva no depende del reloj del cliente)

/* ---------- utilidades ---------- */
export const money = (n) => `${tienda.moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR")}`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const precioFinal = (p) => Math.round(p.precio * (1 - (p.descuento || 0) / 100));
export const findProd = (id) => PRODUCTOS.find((x) => x.id === Number(id));
export const ofertas = PRODUCTOS.filter((p) => p.descuento > 0 && p.stock > 0).sort((a, b) => b.descuento - a.descuento);
export const waLink = (texto) => (tienda.whatsapp ? `https://wa.me/${tienda.whatsapp}${texto ? `?text=${encodeURIComponent(texto)}` : ""}` : "");
let toastTimer;
export function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- carrito ---------- */
const CART_KEY = "ks-cart";
export const onCartChange = [];
function normalizar(raw) {
  const out = {};
  for (const [id, n] of Object.entries(raw || {})) {
    const p = findProd(id);
    if (p && p.stock > 0 && n > 0) out[id] = Math.min(Math.trunc(n), p.stock);
  }
  return out;
}
function cargar() {
  try { return normalizar(JSON.parse(localStorage.getItem(CART_KEY) || "{}")); } catch { return {}; }
}
export let cart = cargar();
function guardar() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }
export function cartTotals() {
  const entries = Object.entries(cart).map(([id, n]) => ({ p: findProd(id), n }));
  return {
    entries,
    units: entries.reduce((a, e) => a + e.n, 0),
    total: entries.reduce((a, e) => a + e.n * precioFinal(e.p), 0),
    ahorro: entries.reduce((a, e) => a + e.n * (e.p.precio - precioFinal(e.p)), 0),
  };
}
export function setQty(id, n) {
  const p = findProd(id);
  const q = Math.max(0, Math.min(n, p.stock));
  if (q === 0) delete cart[id]; else cart[id] = q;
  guardar();
  renderCart();
  onCartChange.forEach((fn) => fn());
}
export function clearCart() {
  cart = {};
  guardar();
  renderCart();
  onCartChange.forEach((fn) => fn());
}

/* ---------- tarjetas ---------- */
export function phoneArt(p) {
  return p.img
    ? `<img class="photo" src="${esc(p.img)}" alt="${esc(p.modelo)}" loading="lazy">`
    : `<div class="mini"></div>`;
}
// Si una foto no carga, se dibuja el teléfono.
document.addEventListener("error", (e) => {
  const el = e.target;
  if (el.tagName === "IMG" && el.classList.contains("photo")) {
    const mini = document.createElement("div");
    mini.className = "mini";
    el.replaceWith(mini);
  }
}, true);

export function cardHTML(p, i = 0, instant = false) {
  const enCarrito = cart[p.id] || 0;
  const libres = p.stock - enCarrito;
  const bat = p.estado === "usado" && p.bateria ? ` · Batería ${p.bateria}%` : "";
  const stockTxt = p.stock === 0 ? "Agotado" : libres === 0 ? "Reservaste todo el stock" : libres <= 2 ? `¡Quedan solo ${libres}!` : `${libres} en stock`;
  const stockCls = p.stock > 0 && libres > 0 && libres <= 2 ? "low-s" : "";
  const btn =
    p.stock === 0 ? `<button class="btn btn-sm" disabled>Sin stock</button>`
    : libres <= 0 ? `<button class="btn btn-sm" disabled>Máximo en carrito</button>`
    : `<button class="btn btn-sm" data-add="${p.id}">Agregar al carrito</button>`;
  const precio = p.descuento
    ? `<div class="price"><s>${money(p.precio)}</s> ${money(precioFinal(p))} <small>${tienda.moneda}</small></div>`
    : `<div class="price">${money(p.precio)} <small>${tienda.moneda}</small></div>`;
  return `<article class="card ${instant ? "in" : ""} ${p.stock === 0 ? "agotado" : ""}" style="--tono:${esc(p.tono)};transition-delay:${instant ? 0 : (i % 4) * 80}ms">
    <div class="card-img">
      <span class="tag">${p.estado === "usado" ? "Usado" : "Nuevo"}</span>
      ${p.descuento ? `<span class="off">−${p.descuento}%</span>` : ""}
      ${phoneArt(p)}
    </div>
    <div class="card-body">
      <h3>${esc(p.modelo)}</h3>
      <span class="meta">${p.gb ? p.gb + " GB · " : ""}${esc(p.color)}${bat}</span>
      <span class="stock ${stockCls}">${stockTxt}</span>
      ${enCarrito ? `<span class="incart">${enCarrito} en tu carrito</span>` : ""}
      ${precio}
      ${btn}
    </div>
  </article>`;
}
export function renderGrid(el, list, instant = false) {
  el.innerHTML = list.map((p, i) => cardHTML(p, i, instant)).join("");
  observe(el);
}

/* ---------- animaciones de entrada ---------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
export function observe(root = document) {
  root.querySelectorAll(".reveal:not(.in), .card:not(.in), .svc:not(.in)").forEach((el) => io.observe(el));
}

/* ---------- cuenta regresiva (se reutiliza en inicio y ofertas) ---------- */
export function countdown(el) {
  const fin = tienda.hotSale?.hasta ? Date.parse(tienda.hotSale.hasta) : 0;
  const tick = () => {
    const left = fin - ahora();
    if (!fin || left <= 0) { el.hidden = true; return false; }
    const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
    el.hidden = false;
    el.innerHTML = [["días", d], ["hs", h], ["min", m], ["seg", s]].map(([l, v]) => `<div><strong>${String(v).padStart(2, "0")}</strong><span>${l}</span></div>`).join("");
    return true;
  };
  if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 1000); }
}

/* ---------- carrito: cajón lateral ---------- */
function renderCart() {
  const { entries, units, total } = cartTotals();
  const badge = $("cartCount");
  badge.hidden = units === 0;
  badge.textContent = units;
  $("cartTotal").textContent = money(total);
  const bar = $("cartBar");
  const verBarra = units > 0 && document.body.dataset.page !== "pago";
  bar.hidden = !verBarra;
  document.body.classList.toggle("has-cartbar", verBarra);
  bar.innerHTML = `<span>Ver carrito · ${units} equipo${units === 1 ? "" : "s"}</span><strong>${money(total)}</strong>`;
  $("checkout").hidden = units === 0;
  $("cartClear").hidden = units === 0;
  $("cartItems").innerHTML = units
    ? entries.map(({ p, n }) => `<div class="ci" style="--tono:${esc(p.tono)}">
        <div class="thumb">${phoneArt(p)}</div>
        <div>
          <h4>${esc(p.modelo)}</h4>
          <div class="meta">${p.gb ? p.gb + " GB · " : ""}${esc(p.color)}</div>
          <div class="qty">
            <button data-dec="${p.id}" aria-label="Quitar uno">−</button>
            <span>${n}</span>
            <button data-inc="${p.id}" aria-label="Agregar uno" ${n >= p.stock ? "disabled" : ""}>+</button>
          </div>
        </div>
        <div class="pr">${money(precioFinal(p) * n)}<button class="rm" data-rm="${p.id}">Quitar</button></div>
      </div>`).join("")
    : `<p class="cart-empty">Tu carrito está vacío.<br>Agregá un iPhone del catálogo.</p>`;
}
function openCart(open) {
  const d = $("drawer"), o = $("overlay");
  if (open) {
    o.hidden = false;
    requestAnimationFrame(() => { o.classList.add("show"); d.classList.add("open"); });
  } else {
    o.classList.remove("show");
    d.classList.remove("open");
    setTimeout(() => { if (!d.classList.contains("open")) o.hidden = true; }, 350);
  }
  d.setAttribute("aria-hidden", String(!open));
  document.body.style.overflow = open ? "hidden" : "";
}

/* ---------- cabecera, pie y comportamiento global ---------- */
function mountLayout() {
  const actual = document.body.dataset.page;
  document.documentElement.style.setProperty("--accent", tienda.acento);
  const titulo = document.body.dataset.title || "";
  document.title = `${titulo ? titulo + " · " : ""}${tienda.nombre}`;

  const paginas = [
    ["/", "Inicio", "home"],
    ["/catalogo", "Catálogo", "catalogo"],
    ofertas.length && ["/ofertas", "Ofertas", "ofertas"],
    ["/nosotros", "Nosotros", "nosotros"],
  ].filter(Boolean);

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="top" id="top">
      <div class="wrap top-in">
        <a class="logo" href="/" aria-label="Inicio">${esc(tienda.nombre)}</a>
        <nav class="nav" aria-label="Principal">
          ${paginas.map(([h, t, k]) => `<a href="${h}" ${k === actual ? 'class="on" aria-current="page"' : ""}>${t}</a>`).join("")}
        </nav>
        <button class="cart-btn" id="cartBtn" aria-label="Abrir carrito">${icon("bag", 22)}<span class="cart-count" id="cartCount" hidden>0</span></button>
      </div>
    </header>`);

  const sinFotos = PRODUCTOS.some((p) => !p.img);
  document.body.insertAdjacentHTML("beforeend", `
    <footer class="foot">
      <div class="wrap foot-in">
        <span>© ${new Date().getFullYear()} ${esc(tienda.nombre)}</span>
        <span class="foot-by"><img src="/img/logo-ks.png" alt="" width="20" height="20"> Sitio por Korion Systems</span>
        ${sinFotos ? '<p class="foot-note">Las imágenes de los equipos son ilustraciones. Colores y detalles son referenciales.</p>' : ""}
      </div>
    </footer>
    <div class="overlay" id="overlay" hidden></div>
    <aside class="drawer" id="drawer" aria-label="Carrito" aria-hidden="true">
      <div class="drawer-head">
        <h2>Tu carrito</h2>
        <button class="x" id="cartClose" aria-label="Cerrar carrito">${icon("close", 20)}</button>
      </div>
      <div class="drawer-body" id="cartItems"></div>
      <div class="drawer-foot">
        <div class="total"><span>Total</span><strong id="cartTotal"></strong></div>
        <a class="btn btn-ink btn-block" id="checkout" href="/pago">Ir a pagar</a>
        <button class="link" id="cartClear">Vaciar carrito</button>
      </div>
    </aside>
    <button class="cartbar" id="cartBar" hidden></button>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`);

  $("cartBtn").addEventListener("click", () => openCart(true));
  $("cartBar").addEventListener("click", () => openCart(true));
  $("cartClose").addEventListener("click", () => openCart(false));
  $("overlay").addEventListener("click", () => openCart(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape") openCart(false); });
  $("cartClear").addEventListener("click", clearCart);
  $("cartItems").addEventListener("click", (e) => {
    const t = e.target.closest("[data-inc],[data-dec],[data-rm]");
    if (!t) return;
    const id = t.dataset.inc || t.dataset.dec || t.dataset.rm;
    if (t.dataset.inc) setQty(id, (cart[id] || 0) + 1);
    else if (t.dataset.dec) setQty(id, (cart[id] || 0) - 1);
    else setQty(id, 0);
  });

  // "Agregar al carrito" desde cualquier tarjeta
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const id = b.dataset.add;
    setQty(id, (cart[id] || 0) + 1);
    const badge = $("cartCount");
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
    toast(`${findProd(id).modelo} agregado al carrito`);
  });

  // Si el carrito cambia en otra pestaña
  addEventListener("storage", (e) => {
    if (e.key === CART_KEY) { cart = cargar(); renderCart(); onCartChange.forEach((fn) => fn()); }
  });

  // Cabecera translúcida al hacer scroll + parallax opcional
  let ticking = false;
  const tick = () => {
    const y = scrollY;
    $("top").classList.toggle("scrolled", y > 8);
    window.onParallax && window.onParallax(y);
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
  tick();

  renderCart();
  hydrateIcons();
  observe();
}
mountLayout();

// Enlaces y textos que dependen de la tienda
document.querySelectorAll("[data-wa]").forEach((a) => {
  const link = waLink(a.dataset.wa.replace("{tienda}", tienda.nombre));
  if (link) a.href = link; else a.hidden = true; // sin número cargado no se muestra el botón
});
document.querySelectorAll("[data-store]").forEach((el) => {
  const v = tienda[el.dataset.store];
  if (v) el.textContent = v; else el.hidden = true;
});

/* ---------- fin de la pantalla de carga ---------- */
// Cada página llama a finish() cuando terminó de pintar. El logo se queda un mínimo para que se aprecie.
export function finish() {
  const root = document.documentElement;
  if (!root.classList.contains("loading")) return;
  setTimeout(() => {
    root.classList.add("loaded");
    try { sessionStorage.setItem("ks-loaded", "1"); } catch {}
    setTimeout(() => root.classList.remove("loading", "loaded"), 800);
  }, Math.max(0, 1700 - performance.now()));
}
