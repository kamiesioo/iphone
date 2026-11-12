// Se ejecuta antes de pintar: decide si se muestra la pantalla de carga (una vez por sesión).
(function () {
  try {
    if (!sessionStorage.getItem("ks-loaded") && !/[?&]nl\b/.test(location.search)) document.documentElement.classList.add("loading");
  } catch (e) {}
})();
