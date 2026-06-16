// =====================================================================
// Núcleo a escala — el viaje del átomo, salto a salto ×10.
//
// RECONSTRUCCIÓN POR PASOS.
// Paso 1 (actual): estado inicial estático.
//   · Zona de simulación (lienzo): el ÁTOMO completo con todas sus capas
//     electrónicas. NO se dibuja el núcleo (es demasiado pequeño para verlo a
//     esta escala). Bajo el átomo, una COTA marca su diámetro real, con la
//     leyenda "Átomo de XXXXX". Arriba a la derecha, un recuadro avisa de que el
//     núcleo está en el centro pero es invisible a esta escala.
//   · Zona de líneas (franja inferior): una ÚNICA línea, del tamaño del
//     diámetro del núcleo.
//   · Botones de zoom: presentes, todavía SIN funcionalidad.
// =====================================================================

// ---------------------------------------------------------------------
// Catálogo de elementos: Z protones, A número de masa (isótopo común,
// N = A-Z neutrones), y configuración electrónica simplificada por
// capas (K, L, M…), tal como se enseña en secundaria. El radio atómico
// empírico (pm) ancla la capa más externa; las internas se escalan con
// n² (aproximación didáctica, no un cálculo cuántico riguroso).
// ---------------------------------------------------------------------
const ELEMENTS = [
  { id: "H", name: "Hidrógeno", Z: 1, A: 1, shells: [1], atomicRadiusPm: 53 },
  { id: "He", name: "Helio", Z: 2, A: 4, shells: [2], atomicRadiusPm: 31 },
  { id: "C", name: "Carbono", Z: 6, A: 12, shells: [2, 4], atomicRadiusPm: 70 },
  { id: "O", name: "Oxígeno", Z: 8, A: 16, shells: [2, 6], atomicRadiusPm: 60 },
  { id: "Na", name: "Sodio", Z: 11, A: 23, shells: [2, 8, 1], atomicRadiusPm: 190 },
  { id: "Fe", name: "Hierro", Z: 26, A: 56, shells: [2, 8, 14, 2], atomicRadiusPm: 126 },
  { id: "Au", name: "Oro", Z: 79, A: 197, shells: [2, 8, 18, 32, 18, 1], atomicRadiusPm: 144 },
  { id: "U", name: "Uranio", Z: 92, A: 238, shells: [2, 8, 18, 32, 21, 9, 2], atomicRadiusPm: 156 },
];

const SHELL_NAMES = ["K", "L", "M", "N", "O", "P", "Q"];

// Paleta indexada por SALTO (se usará en pasos posteriores para enlazar la zona
// de simulación con la de líneas). El salto 0 (núcleo) es rojo.
const STEP_COLORS = [
  { dark: [239, 68, 68], light: [200, 40, 40] }, //  0  Núcleo   · rojo
  { dark: [245, 158, 11], light: [180, 110, 5] }, //  1  ×10¹     · ámbar
  { dark: [16, 185, 129], light: [6, 120, 80] }, //  2  ×10²     · verde
  { dark: [6, 182, 212], light: [12, 120, 150] }, //  3  ×10³     · cian
  { dark: [59, 130, 246], light: [26, 82, 190] }, //  4  ×10⁴     · azul
  { dark: [139, 92, 246], light: [100, 50, 200] }, //  5  ×10⁵     · violeta
  { dark: [236, 72, 153], light: [180, 30, 110] }, //  6  ×10⁶     · rosa
  { dark: [20, 184, 166], light: [10, 120, 110] }, //  7  ×10⁷     · turquesa
];

const PROTON_COLOR = [220, 50, 50];
const NEUTRON_COLOR = [148, 163, 184];

const BASE_PX = 100; // tamaño en píxeles del núcleo (salto 0) a escala "cómoda"

// ---------------------------------------------------------------------
// Cálculo derivado de cada elemento (radios reales en metros)
// ---------------------------------------------------------------------
function computeElement(el) {
  const N = el.A - el.Z;
  const nucleusDiameterM = 2 * 1.2e-15 * Math.pow(el.A, 1 / 3); // fórmula empírica r=1.2fm·A^(1/3)
  const numShells = el.shells.length;
  const outerRadiusM = el.atomicRadiusPm * 1e-12;
  const scale = outerRadiusM / (numShells * numShells); // ancla la capa externa al radio atómico real
  const shellDiametersM = el.shells.map((_, i) => 2 * scale * (i + 1) * (i + 1));
  const atomDiameterM = 2 * outerRadiusM;
  return Object.assign({}, el, { N, nucleusDiameterM, shellDiametersM, atomDiameterM });
}
const ELEMENT_DATA = {};
ELEMENTS.forEach((el) => { ELEMENT_DATA[el.id] = computeElement(el); });

// ---------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------
let currentElementId = "H";
let clickIndex = 0; // 0 = solo el núcleo, sin saltos todavía (zoom: paso posterior)
let nucleonLayoutCache = null; // posiciones cacheadas de nucleones (para pasos posteriores)
let electronAngles = []; // fase de giro de los electrones por capa (animación)

// Escala de la franja de líneas (DOM). En el paso 1 solo hay una línea (núcleo)
// a tamaño cómodo (BASE_PX).
let ladderScalePx = BASE_PX;

const uiCache = { theme: "dark" };
let diagramCx = 0, diagramCy = 0, diagramMaxRadiusPx = 0; // geometría, recalculada en resize

// =====================================================================
// Utilidades numéricas y de formato
// =====================================================================

const SUPERSCRIPT_MAP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] !== undefined ? SUPERSCRIPT_MAP[ch] : ch).join("");
}

// Expresa un número grande como "N veces" (coloquial) o "m × 10^n veces" (científico).
function formatTimes(ratio) {
  if (!isFinite(ratio) || ratio <= 0) return "—";
  if (ratio < 1000) {
    const r = Math.round(ratio * 10) / 10;
    return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1).replace(".", ",")) + " veces";
  }
  const exp = Math.floor(Math.log10(ratio));
  const mantissa = ratio / Math.pow(10, exp);
  return mantissa.toFixed(2).replace(".", ",") + " × 10" + toSuperscript(exp) + " veces";
}

function formatSig(value, sig) {
  if (value === 0) return "0";
  const rounded = parseFloat(value.toPrecision(sig));
  return Math.abs(rounded) >= 1
    ? rounded.toLocaleString("es-ES", { maximumFractionDigits: Math.max(0, sig - String(Math.trunc(Math.abs(rounded))).length) })
    : rounded.toString().replace(".", ",");
}

function formatLength(m) {
  const a = Math.abs(m);
  let unit, value;
  if (a >= 1) { unit = "m"; value = m; }
  else if (a >= 1e-2) { unit = "cm"; value = m * 100; }
  else if (a >= 1e-3) { unit = "mm"; value = m * 1000; }
  else if (a >= 1e-6) { unit = "µm"; value = m * 1e6; }
  else if (a >= 1e-9) { unit = "nm"; value = m * 1e9; }
  else if (a >= 1e-12) { unit = "pm"; value = m * 1e12; }
  else { unit = "fm"; value = m * 1e15; }
  return formatSig(value, 3) + " " + unit;
}

// Longitud en metros con notación científica (p.ej. "1,06 × 10⁻¹⁰ m").
function formatScientificM(m) {
  if (m === 0) return "0 m";
  const exp = Math.floor(Math.log10(Math.abs(m)));
  const mant = m / Math.pow(10, exp);
  return mant.toFixed(2).replace(".", ",") + " × 10" + toSuperscript(exp) + " m";
}

function categoryColor(entry) {
  return uiCache.theme === "light" ? entry.light : entry.dark;
}
function rgbStr(arr, alpha) {
  return alpha === undefined ? "rgb(" + arr.join(",") + ")" : "rgba(" + arr.join(",") + "," + alpha + ")";
}
function stepColor(i) { return categoryColor(STEP_COLORS[i % STEP_COLORS.length]); }

// Colores derivados del tema actual (equivalentes a las variables CSS).
function mutedText(theme) {
  return theme === "light" ? [100, 116, 139] : theme === "high-contrast" ? [204, 204, 204] : [154, 166, 189];
}
function inkText(theme) {
  return theme === "light" ? [12, 26, 40] : theme === "high-contrast" ? [255, 255, 255] : [226, 232, 240];
}
function accentColor(theme) {
  return theme === "light" ? [26, 82, 190] : theme === "high-contrast" ? [255, 255, 0] : [96, 165, 250];
}
function cardColors(theme) {
  if (theme === "light") return { bg: [205, 212, 222], border: [143, 160, 178], ink: [12, 26, 40] };
  if (theme === "high-contrast") return { bg: [24, 24, 24], border: [255, 255, 255], ink: [255, 255, 255] };
  return { bg: [30, 35, 52], border: [43, 49, 71], ink: [238, 242, 248] };
}

// =====================================================================
// Lógica del viaje de zoom (andamiaje para pasos posteriores)
// =====================================================================

function getElement() { return ELEMENT_DATA[currentElementId]; }

// Diámetro real (m) que representa la línea del salto i (i=0 → el propio núcleo).
function lineDiameterM(el, i) { return el.nucleusDiameterM * Math.pow(10, i); }

function maxClickIndex(el) {
  const outerDiam = el.shellDiametersM[el.shellDiametersM.length - 1];
  let i = 0;
  while (lineDiameterM(el, i) < outerDiam && i < 30) i++;
  return i;
}

// =====================================================================
// p5 — ciclo de vida
// =====================================================================

function setup() {
  const holder = document.getElementById("canvas-holder");
  const w = holder && holder.offsetWidth ? holder.offsetWidth : 870;
  const h = holder && holder.offsetHeight ? holder.offsetHeight : 600;
  const canvas = createCanvas(w, h);
  canvas.parent("canvas-holder");
  recomputeLayout();
  populateElementSelect();
  setupAppearanceEventListeners();
  setupUIEventListeners();
  resetJourney(); // estado inicial + pinta panel lateral y franja inferior
}

function windowResized() {
  const holder = document.getElementById("canvas-holder");
  if (!holder) return;
  resizeCanvas(holder.offsetWidth, holder.offsetHeight);
  recomputeLayout();
  renderLadder(); // mantiene la barra de la franja con el mismo nº de píxeles que la flecha del lienzo
}

function recomputeLayout() {
  diagramCx = width / 2;
  diagramCy = height / 2;
  diagramMaxRadiusPx = Math.max(20, Math.min(width, height) / 2 - 28);
}

// Rectángulo (px) del recuadro informativo del núcleo, en la esquina superior
// derecha. Centralizado para que la geometría del átomo pueda esquivarlo.
function nucleusInfoBoxRect() {
  const w = Math.min(252, Math.max(176, width * 0.36));
  return { x: width - w - 14, y: 72, w: w, h: 70 };
}

// Distancia de un punto al rectángulo r (0 si el punto está dentro).
function pointRectDist(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

// Geometría del átomo dibujado (centro y radio en px). El radio se limita para
// que el círculo más externo (y sus electrones) NUNCA toque el recuadro del
// núcleo. La usan tanto el lienzo como la franja inferior, de modo que la barra
// de abajo pueda medir exactamente lo mismo que la flecha del diámetro.
function atomLayout() {
  const cx = width / 2;
  const areaTop = 26;
  const areaBottom = height - 84; // espacio inferior para la cota y la leyenda
  const cy = (areaTop + areaBottom) / 2;
  let atomR = Math.max(24, Math.min((areaBottom - areaTop) / 2, (width - 140) / 2)) * 0.94;
  const clearance = pointRectDist(cx, cy, nucleusInfoBoxRect()) - 10;
  atomR = Math.max(24, Math.min(atomR, clearance));
  return { cx, cy, atomR };
}

function draw() {
  const theme = uiCache.theme;
  background(theme === "light" ? [248, 250, 252] : theme === "high-contrast" ? [0, 0, 0] : [11, 12, 16]);
  const el = getElement();
  drawAtomView(theme, el);
  drawNucleusInfoBox(theme);
}

// =====================================================================
// Zona de simulación (paso 1): el átomo completo + cota del diámetro
// =====================================================================

function drawAtomView(theme, el) {
  const cx = width / 2;
  const topMargin = 26;
  const cotaZone = 84; // espacio inferior reservado para la cota y la leyenda
  const areaTop = topMargin;
  const areaBottom = height - cotaZone;
  const cy = (areaTop + areaBottom) / 2;
  const maxR = Math.max(24, Math.min((areaBottom - areaTop) / 2, (width - 140) / 2));
  const atomR = maxR * 0.94;
  const numShells = el.shells.length;

  const acc = accentColor(theme);
  const mt = mutedText(theme);

  // Avanza la fase de giro de cada capa (capas externas, más lentas).
  while (electronAngles.length < numShells) electronAngles.push(random(TWO_PI));

  push();
  for (let s = 0; s < numShells; s++) {
    const rs = atomR * (s + 1) / numShells;

    // Órbita (círculo de la capa)
    noFill();
    stroke(acc[0], acc[1], acc[2], 150);
    strokeWeight(1.3);
    circle(cx, cy, rs * 2);

    // Electrones repartidos por la capa, girando suavemente
    const ne = el.shells[s];
    electronAngles[s] += (0.32 / Math.sqrt(s + 1)) * (deltaTime / 1000);
    noStroke();
    fill(acc[0], acc[1], acc[2]);
    for (let k = 0; k < ne; k++) {
      const ang = electronAngles[s] + (k / ne) * TWO_PI;
      circle(cx + rs * Math.cos(ang), cy + rs * Math.sin(ang), 6);
    }
  }
  pop();

  drawDiameterCota(theme, cx, cy, atomR, el);
}

// Cota (línea de medida) del diámetro del átomo, justo debajo del dibujo, con su
// valor real y la leyenda "Átomo de XXXXX".
function drawDiameterCota(theme, cx, cy, atomR, el) {
  const ink = inkText(theme);
  const acc = accentColor(theme);
  const y = cy + atomR + 24;
  const x1 = cx - atomR, x2 = cx + atomR;

  push();
  stroke(acc[0], acc[1], acc[2]);
  strokeWeight(6);
  line(x1, y, x2, y);             // línea horizontal
  line(x1, y - 8, x1, y + 8);     // tope izquierdo
  line(x2, y - 8, x2, y + 8);     // tope derecho
  noStroke();
  fill(acc[0], acc[1], acc[2]);
  triangle(x1, y, x1 + 14, y - 7, x1 + 14, y + 7); // punta hacia dentro (izq.)
  triangle(x2, y, x2 - 14, y - 7, x2 - 14, y + 7); // punta hacia dentro (der.)
  pop();

  push();
  textAlign(CENTER, BOTTOM);
  textStyle(BOLD);
  textSize(12);
  fill(ink[0], ink[1], ink[2]);
  text("Ø " + formatLength(el.atomDiameterM), cx, y - 5); // valor sobre la línea
  textAlign(CENTER, TOP);
  textSize(13.5);
  text("Átomo de " + el.name, cx, y + 12);                // leyenda bajo la línea
  textStyle(NORMAL);
  pop();
}

// Recuadro superior derecho que advierte de que el núcleo no es visible aquí.
function drawNucleusInfoBox(theme) {
  const card = cardColors(theme);
  const msg = "El núcleo está en el centro, pero es demasiado pequeño para verlo.";
  const boxW = Math.min(252, Math.max(176, width * 0.36));
  const pad = 12;
  const x = width - boxW - 14;
  const y = 20; // alejado del engranaje para no tapar órbita
  const boxH = 70;

  push();
  rectMode(CORNER);
  stroke(card.border[0], card.border[1], card.border[2]);
  strokeWeight(1);
  fill(card.bg[0], card.bg[1], card.bg[2]);
  rect(x, y, boxW, boxH, 9);

  // Marca roja (color del núcleo) en el borde izquierdo del recuadro.
  noStroke();
  const red = stepColor(0);
  fill(red[0], red[1], red[2]);
  rect(x + 1, y + 9, 3, boxH - 18, 2);

  fill(card.ink[0], card.ink[1], card.ink[2]);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(11.5);
  textLeading(15);
  textWrap(WORD);
  text(msg, x + pad, y + 12, boxW - pad - 10);
  pop();
}

// =====================================================================
// Nucleones y etiqueta de salto: andamiaje para pasos posteriores (no se usan
// todavía en el paso 1, pero se conservan para no rehacerlos después).
// =====================================================================

function buildNucleonLayout(el) {
  const total = el.A;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const types = [];
  for (let i = 0; i < el.Z; i++) types.push("p");
  for (let i = 0; i < el.N; i++) types.push("n");
  let seed = el.Z * 1000 + el.A;
  function nextRand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = types[i]; types[i] = types[j]; types[j] = tmp;
  }
  return types.map((type, i) => {
    const r = Math.sqrt((i + 0.5) / total);
    const theta = i * golden;
    return { type, x: r * Math.cos(theta), y: r * Math.sin(theta) };
  });
}

function getNucleonLayout(el) {
  if (!nucleonLayoutCache || nucleonLayoutCache.id !== el.id) {
    nucleonLayoutCache = { id: el.id, points: buildNucleonLayout(el) };
  }
  return nucleonLayoutCache.points;
}

// Texto de apoyo con ajuste de línea (reutilizable en pasos posteriores).
function drawCaption(theme, x, y, str, col, align, maxWidth) {
  const w = maxWidth || 160;
  let boxX = align === LEFT ? x : x - w / 2;
  boxX = constrain(boxX, 2, Math.max(2, width - w - 2));
  push();
  textAlign(align === LEFT ? LEFT : CENTER, TOP);
  textSize(10.5);
  textWrap(WORD);
  fill(col[0], col[1], col[2]);
  text(str, boxX, y, w);
  pop();
}

// =====================================================================
// Panel lateral: datos del elemento, progreso, franja de líneas (DOM)
// =====================================================================

function populateElementSelect() {
  const select = document.getElementById("ui-element-select");
  select.innerHTML = ELEMENTS.map((el) => '<option value="' + el.id + '">' + el.name + " (Z=" + el.Z + ")</option>").join("");
  select.value = currentElementId;
}

function renderElementFacts() {
  const el = getElement();
  const box = document.getElementById("element-facts");
  const rows = [
    ["Protones (Z)", el.Z],
    ["Neutrones (N)", el.N],
    ["Número de masa (A)", el.A],
    ["Diámetro del núcleo", formatLength(el.nucleusDiameterM)],
    ["Diámetro del átomo", formatLength(el.atomDiameterM)],
    ["Capas electrónicas", el.shells.length + " (" + el.shells.map((c, i) => SHELL_NAMES[i] + ":" + c).join(", ") + ")"],
  ];
  box.innerHTML = rows.map((r) => '<div class="fact-row"><span>' + r[0] + '</span><span class="fact-value">' + r[1] + "</span></div>").join("");
}

function renderJourneyProgress() {
  const el = getElement();
  const total = maxClickIndex(el);
  const fill = document.getElementById("ui-progress-fill");
  const text = document.getElementById("ui-progress-text");
  const pct = total === 0 ? 0 : Math.round((clickIndex / total) * 100);
  if (fill) fill.style.width = pct + "%";
  if (text) text.innerText = "Salto " + clickIndex + " de " + total;

  // Paso 1: los botones se muestran pero su funcionalidad llegará después.
  const btnOut = document.getElementById("ui-btn-zoom-out");
  if (btnOut) { btnOut.disabled = false; btnOut.innerHTML = "➖ Alejar (×10)"; }
  const btnIn = document.getElementById("ui-btn-zoom-in");
  if (btnIn) btnIn.disabled = true; // "Acercar" deshabilitado: aún no hay zoom del que volver
}

// Franja inferior: en el paso 1, una única línea del tamaño del diámetro del átomo completo.
function renderLadder() {
  const el = getElement();
  const section = document.getElementById("ladder-section");
  const barColor = accentColor(uiCache.theme);
  
  // Calcular atomR con la misma lógica que en drawAtomView() para que la barra tenga la misma longitud
  const topMargin = 26;
  const cotaZone = 84;
  const areaTop = topMargin;
  const areaBottom = height - cotaZone;
  const maxR = Math.max(24, Math.min((areaBottom - areaTop) / 2, (width - 140) / 2));
  const atomR = maxR * 0.94;
  const atomBarPx = atomR * 2; // diámetro = 2 * radio
  
  // Mostrar tanto en unidades como en notación científica
  const valueInUnits = formatLength(el.atomDiameterM);
  const valueInScientific = formatScientificM(el.atomDiameterM);
  
  section.innerHTML =
    '<div class="ladder-row">' +
    '<span class="ladder-row-label"><span class="ladder-row-swatch" style="background:' + rgbStr(barColor) + '"></span>Átomo de ' + el.name + '</span>' +
    '<span class="ladder-row-bar" style="width:' + atomBarPx + "px; background:" + rgbStr(barColor) + '; margin-right: 12px;"></span>' +
    '<span class="ladder-row-value" style="flex-shrink: 0; margin-left: auto;">' + valueInUnits + " / " + valueInScientific + "</span>" +
    "</div>";
  section.scrollLeft = 0;
}

function refreshAll() {
  renderElementFacts();
  renderJourneyProgress();
  renderLadder();
}

// =====================================================================
// Controles de UI
// =====================================================================

function resetJourney() {
  clickIndex = 0;
  ladderScalePx = BASE_PX;
  refreshAll();
}

function setupUIEventListeners() {
  document.getElementById("ui-element-select").addEventListener("change", (e) => {
    currentElementId = e.target.value;
    electronAngles = [];
    resetJourney();
  });

  // Zoom: funcionalidad pendiente (paso posterior). De momento, sin efecto.
  document.getElementById("ui-btn-zoom-out").addEventListener("click", () => { /* TODO: alejar ×10 */ });
  document.getElementById("ui-btn-zoom-in").addEventListener("click", () => { /* TODO: acercar ÷10 */ });

  document.getElementById("ui-btn-reset").addEventListener("click", () => {
    resetJourney();
  });

  const infoCard = document.getElementById("ui-panel-info");
  document.getElementById("ui-info-trigger").addEventListener("click", () => {
    infoCard.classList.toggle("is-expanded");
  });
}

function setupAppearanceEventListeners() {
  const trigger = document.getElementById("ui-dropdown-trigger");
  const container = document.getElementById("ui-dropdown-container");
  if (trigger && container) {
    trigger.addEventListener("click", (e) => { e.stopPropagation(); container.classList.toggle("is-active"); });
    const card = container.querySelector(".dropdown-card");
    if (card) card.addEventListener("click", (e) => { e.stopPropagation(); });
    document.addEventListener("click", () => { container.classList.remove("is-active"); });
  }

  const root = document.documentElement;
  const themeSelect = document.getElementById("ui-theme-select");
  const curTheme = root.getAttribute("data-theme") || "dark";
  if (themeSelect) themeSelect.value = curTheme;
  uiCache.theme = curTheme;
  if (themeSelect) themeSelect.addEventListener("change", (e) => {
    uiCache.theme = e.target.value;
    root.setAttribute("data-theme", e.target.value);
    try { localStorage.setItem("sim-ui-theme", e.target.value); } catch (err) {}
    renderLadder();
  });

  const densitySelect = document.getElementById("ui-density-select");
  const curDensity = root.getAttribute("data-ui") || "compact";
  if (densitySelect) {
    densitySelect.value = curDensity;
    densitySelect.addEventListener("change", (e) => {
      root.setAttribute("data-ui", e.target.value);
      try { localStorage.setItem("sim-ui-density", e.target.value); } catch (err) {}
      windowResized();
      renderLadder();
    });
  }
}
