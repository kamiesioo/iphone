/* Ofertas: productos con descuento y cuenta regresiva. */
import { $, tienda, PRODUCTOS, renderGrid, onCartChange, countdown, finish } from "./common.js";

$("hotTitle").textContent = tienda.hotSale?.titulo || "Hot Sale";
countdown($("countdown"));

// Primero los que tienen stock (mayor descuento arriba); los agotados quedan al final.
const lista = PRODUCTOS.filter((p) => p.descuento > 0).sort((a, b) => (b.stock > 0) - (a.stock > 0) || b.descuento - a.descuento);
function render(instant = false) {
  $("empty").hidden = lista.length > 0;
  renderGrid($("grid"), lista, instant);
}
render();
onCartChange.push(() => render(true));

finish();
