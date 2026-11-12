/* Inicio: tarjeta de ofertas, destacados, servicios y parallax del hero. */
import { $, tienda, PRODUCTOS, ofertas, renderGrid, onCartChange, observe, countdown, icon, reduceMotion, finish } from "./common.js";

/* tarjeta de ofertas (solo si hay productos en oferta) */
if (ofertas.length) {
  const max = Math.max(...ofertas.map((p) => p.descuento));
  $("promoWrap").hidden = false;
  $("heroHot").hidden = false;
  $("promoTitle").textContent = tienda.hotSale?.titulo || "Hot Sale";
  $("promoText").textContent = `Hasta ${max}% de descuento en ${ofertas.length} equipo${ofertas.length === 1 ? "" : "s"}.`;
  countdown($("countdown"));
}

/* destacados: primeros equipos con stock que no están en oferta */
const destacados = PRODUCTOS.filter((p) => p.stock > 0 && !p.descuento).slice(0, 4);
function pintarDestacados(instant = false) { renderGrid($("destacados"), destacados, instant); }
if (destacados.length) {
  $("destacadosWrap").hidden = false;
  pintarDestacados();
  onCartChange.push(() => pintarDestacados(true));
}

/* servicios */
const s = tienda.servicios;
const items = [
  ["shield", "Garantía", "Equipos originales, revisados y con garantía escrita."],
  s.financiacion && ["card", "Financiación", "Pagá en cuotas con tarjeta o DNI. Consultá planes vigentes."],
  s.usados && ["swap", "Recibimos tu usado", "Entregá tu iPhone como parte de pago y cambiá al modelo que querés."],
  s.mayorista && ["box", "Venta mayorista", "Precios especiales por cantidad para revendedores."],
  s.accesorios && ["headphones", "Accesorios", "Fundas, cargadores, vidrios y audio para tu equipo."],
].filter(Boolean);
$("services").innerHTML = items
  .map(([i, t, d], n) => `<div class="svc" style="transition-delay:${n * 90}ms"><div class="ico">${icon(i, 32)}</div><h3>${t}</h3><p>${d}</p></div>`)
  .join("");
observe($("services"));

/* parallax de los dos teléfonos */
const phones = [...document.querySelectorAll(".hphone")];
window.onParallax = (y) => {
  if (reduceMotion || y > innerHeight) return;
  phones.forEach((el, i) => {
    el.style.transform = `translateY(${y * (i ? -0.12 : 0.1)}px) rotate(calc(var(--r) + ${y * (i ? 0.01 : -0.01)}deg)) scale(${1 - y / 3000})`;
  });
};

finish();
