/* Catálogo: búsqueda, filtros y orden. */
import { $, esc, PRODUCTOS, precioFinal, renderGrid, onCartChange, finish } from "./common.js";

const params = new URLSearchParams(location.search);
const state = { q: params.get("q") || "", estado: ["todos", "nuevo", "usado", "oferta"].includes(params.get("estado")) ? params.get("estado") : "todos", linea: "todas", orden: "asc" };

const lineas = ["todas", ...new Set(PRODUCTOS.map((p) => p.linea).filter(Boolean))];
$("linea").innerHTML = lineas.map((l) => `<option value="${esc(l)}">${l === "todas" ? "Todas las líneas" : esc(l)}</option>`).join("");
$("q").value = state.q;
document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.estado === state.estado));

function render(instant = false) {
  const q = state.q.trim().toLowerCase();
  const list = PRODUCTOS.filter(
    (p) =>
      (state.estado === "todos" || (state.estado === "oferta" ? p.descuento > 0 : p.estado === state.estado)) &&
      (state.linea === "todas" || p.linea === state.linea) &&
      (!q || `${p.modelo} ${p.color} ${p.gb}`.toLowerCase().includes(q))
  );
  list.sort((a, b) => state.orden === "asc" ? precioFinal(a) - precioFinal(b) : state.orden === "desc" ? precioFinal(b) - precioFinal(a) : a.modelo.localeCompare(b.modelo));
  $("count").textContent = `${list.length} equipo${list.length === 1 ? "" : "s"}`;
  $("empty").hidden = list.length > 0;
  renderGrid($("grid"), list, instant);
}

render();
onCartChange.push(() => render(true));

$("q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
$("linea").addEventListener("change", (e) => { state.linea = e.target.value; render(); });
$("orden").addEventListener("change", (e) => { state.orden = e.target.value; render(); });
$("estadoChips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  state.estado = b.dataset.estado;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
  render();
});

finish();
