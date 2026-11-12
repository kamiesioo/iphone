/* Pago: resumen, formulario y registro del pedido (se guarda en el servidor y se ofrece enviarlo por WhatsApp). */
import { $, tienda, esc, money, precioFinal, phoneArt, cartTotals, clearCart, onCartChange, toast, reduceMotion, hydrateIcons, finish } from "./common.js";

const s = tienda.servicios;
const metodos = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  s.financiacion && ["tarjeta", "Tarjeta / financiación"],
  s.usados && ["usado", "Parte de pago con mi usado"],
].filter(Boolean);
$("pagoOpts").innerHTML = metodos
  .map(([v, t], i) => `<label class="opt"><input type="radio" name="pago" value="${v}" ${i === 0 ? "checked" : ""}><span>${t}</span></label>`)
  .join("");

const form = $("payForm");
const val = (n) => form.elements[n].value.trim();
const checked = (n) => form.querySelector(`input[name="${n}"]:checked`).value;

function syncFields() {
  $("dirField").hidden = checked("entrega") !== "envio";
  $("usadoField").hidden = checked("pago") !== "usado";
}
form.addEventListener("change", syncFields);
syncFields();

let enviado = false;
function renderSummary() {
  if (enviado) return;
  const { entries, units, total, ahorro } = cartTotals();
  $("emptyCart").hidden = units > 0;
  $("checkoutWrap").hidden = units === 0;
  $("sumItems").innerHTML = entries
    .map(({ p, n }) => `<div class="sum-item" style="--tono:${esc(p.tono)}">
      <div class="thumb">${phoneArt(p)}</div>
      <div><strong>${esc(p.modelo)}</strong><div class="meta">${p.gb ? p.gb + " GB · " : ""}${esc(p.color)} · ${n} u.</div></div>
      <span>${money(precioFinal(p) * n)}</span>
    </div>`)
    .join("");
  $("sumSub").textContent = money(total + ahorro);
  $("sumSaveRow").hidden = ahorro === 0;
  $("sumSave").textContent = "−" + money(ahorro);
  $("sumTotal").textContent = money(total);
}
renderSummary();
onCartChange.push(renderSummary);

function error(msg) {
  const err = $("formErr");
  err.hidden = false;
  err.textContent = msg;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const faltan = [];
  if (!val("nombre")) faltan.push("tu nombre");
  if (val("telefono").replace(/\D/g, "").length < 6) faltan.push("un teléfono válido");
  if (checked("entrega") === "envio" && !val("direccion")) faltan.push("la dirección de envío");
  if (faltan.length) return error("Completá " + faltan.join(", ") + ".");
  $("formErr").hidden = true;

  const btn = $("submitBtn");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const { entries } = cartTotals();
    const r = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: entries.map(({ p, n }) => ({ id: p.id, n })),
        cliente: { nombre: val("nombre"), telefono: val("telefono") },
        entrega: checked("entrega"),
        direccion: val("direccion"),
        pago: checked("pago"),
        usado: val("usado"),
        notas: val("notas"),
      }),
    });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) {
      error(res.error || "No pudimos registrar el pedido. Intentá de nuevo.");
      if (r.status === 409) setTimeout(() => location.reload(), 3500); // stock cambió: recargar datos
      return;
    }
    mostrarListo(res);
  } catch {
    error("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar pedido";
  }
});

function mostrarListo({ codigo, mensaje, wa }) {
  enviado = true;
  $("orderCode").textContent = codigo;
  $("checkoutWrap").hidden = true;
  $("doneWrap").hidden = false;
  hydrateIcons();
  scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  if (wa) {
    $("doneMsg").textContent = "Guardamos tu pedido. Enviá el mensaje por WhatsApp para coordinar el pago y la entrega.";
    $("sendWa").href = wa;
    $("sendWa").hidden = false;
    window.open(wa, "_blank", "noopener"); // si el navegador lo bloquea, queda el botón
  } else {
    $("doneMsg").textContent = "Guardamos tu pedido. La tienda se va a comunicar con vos para coordinar el pago y la entrega. Guardá este código.";
    $("manualBox").hidden = false;
    $("orderText").value = mensaje;
    $("copyBtn").onclick = async () => {
      try { await navigator.clipboard.writeText(mensaje); toast("Pedido copiado"); }
      catch { $("orderText").select(); toast("Seleccioná y copiá el texto"); }
    };
  }
  clearCart();
}

finish();
