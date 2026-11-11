'use strict';
// ── Simulación ya preparada desde la dirección ──────────────────
// Las fichas de actividades del alumnado (simulaciencia.es/fichas/) enlazan a la
// simulación con los ajustes de cada actividad, p. ej. ?modo=materiales&material=hierro.
// Cada parámetro se aplica pulsando o moviendo el mismo control que usaría el
// alumnado, así que el panel queda igual que si se hubiera puesto a mano. Se
// aplican en el orden en que se declaran (primero el modo). Un valor que no se
// entiende se ignora.
const urlParam = {
  // Botón según el valor: urlParam.click({ libre: 'mode-custom', ... })
  click: (map) => (v) => {
    const el = document.getElementById(map[v]);
    if (el) el.click();
  },
  // Activa (1, si) o desactiva (0, no) un botón de alternar o una casilla.
  toggle: (id, isOn) => (v) => {
    const el = document.getElementById(id);
    if (!el) return;
    const want = ['1', 'si', 'sí', 'true'].includes(v);
    if (want !== isOn(el)) el.click();
  },
  // Opción de un desplegable por su value.
  select: (id) => (v) => {
    const el = document.getElementById(id);
    if (!el || ![...el.options].some((o) => o.value.toLowerCase() === v)) return;
    el.value = [...el.options].find((o) => o.value.toLowerCase() === v).value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },
  // Deslizador: el número de la dirección (vale «2,5» o «2.5») por `scale`.
  // El navegador lo recorta al mínimo y al máximo del deslizador.
  range: (id, scale = 1) => (v) => {
    const n = parseFloat(v.replace(',', '.'));
    const el = document.getElementById(id);
    if (!el || !isFinite(n)) return;
    el.value = String(n * scale);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },
};

function aplicarParametrosUrl(spec) {
  const p = new URLSearchParams(location.search);
  for (const [name, apply] of Object.entries(spec)) {
    if (p.has(name)) apply(p.get(name).trim().toLowerCase());
  }
}
