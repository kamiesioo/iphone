/* Nosotros: texto, datos de contacto y mapa. Lo que no esté cargado en el panel simplemente no se muestra. */
import { $, tienda, esc, waLink, hydrateIcons, finish } from "./common.js";

$("sobre").textContent = tienda.sobre || tienda.eslogan;

if (tienda.horario) { $("rowHorario").hidden = false; $("infoHorario").textContent = tienda.horario; }

if (tienda.direccion) {
  $("rowDir").hidden = false;
  $("infoDir").innerHTML = `${esc(tienda.direccion)}${tienda.ciudad ? `<br><span class="muted">${esc(tienda.ciudad)}</span>` : ""}`;
}

// Mapa interactivo: por coordenadas si están cargadas; si no, por la dirección escrita.
const m = tienda.mapa;
const consulta = m ? `${m.lat},${m.lng}` : tienda.direccion ? `${tienda.direccion}, ${tienda.ciudad}` : "";
if (consulta) {
  const q = encodeURIComponent(consulta);
  $("mapBox").hidden = false;
  $("map").innerHTML = `<iframe title="Mapa de ubicación" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&z=${m ? m.zoom : 16}&output=embed"></iframe>`;
  $("mapLink").href = `https://www.google.com/maps?q=${q}`;
}

const wa = waLink("Hola " + tienda.nombre + "!");
if (wa) { $("rowWa").hidden = false; $("infoWa").href = wa; }

if (tienda.instagram) {
  $("rowIg").hidden = false;
  $("infoIg").href = `https://instagram.com/${tienda.instagram}`;
  $("infoIg").textContent = "@" + tienda.instagram;
}

hydrateIcons();
finish();
