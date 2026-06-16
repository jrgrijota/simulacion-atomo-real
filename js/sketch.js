// =====================================================================
// Núcleo a escala — el viaje del átomo, salto a salto ×10.
//
// Idea central: empezamos viendo el núcleo (protones/neutrones reales,
// empaquetados) a un tamaño cómodo en pantalla. Cada clic en "quitar
// zoom" multiplica ×10 la distancia real representada por la línea de
// comparación inferior, y aparece una nueva línea (×10 más larga que
// la anterior) en el diagrama de barras. Cuando un salto alcanza el
// tamaño real de una capa electrónica (K, L, M…), esa capa se revela
// tanto en la línea como en el diagrama de Rutherford (núcleo + órbitas).
//
// Para que la escalera de barras no se salga de la pantalla (con ×10
// reales, al 3er salto ya mediría ~10.000 px), TODAS las barras
// comparten un único factor de compresión (potencia de 10) que solo
// crece cuando la barra más nueva no cabría. Esto preserva exactas las
// proporciones relativas entre todas las líneas, vieja y nueva.
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
const SHELL_COLORS = [
  { dark: [59, 130, 246], light: [26, 82, 190] }, // K azul
  { dark: [16, 185, 129], light: [6, 120, 80] }, // L verde
  { dark: [139, 92, 246], light: [100, 50, 200] }, // M morado
  { dark: [245, 158, 11], light: [180, 110, 5] }, // N ámbar
  { dark: [236, 72, 153], light: [180, 30, 110] }, // O rosa
  { dark: [20, 184, 166], light: [10, 120, 110] }, // P turquesa
  { dark: [234, 179, 8], light: [150, 110, 0] }, // Q amarillo
];
const NUCLEUS_COLOR = { dark: [239, 68, 68], light: [185, 30, 30] }; // color de la línea/etiqueta del núcleo
const PROTON_COLOR = [220, 50, 50];
const NEUTRON_COLOR = [148, 163, 184];
const NEUTRAL_STEP_COLOR = { dark: [100, 112, 138], light: [120, 130, 150] }; // saltos ×10 sin capa nueva

const BASE_PX = 100; // tamaño en píxeles del núcleo (línea 0) antes de cualquier reescalado

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
  return Object.assign({}, el, { N, nucleusDiameterM, shellDiametersM });
}
const ELEMENT_DATA = {};
ELEMENTS.forEach((el) => { ELEMENT_DATA[el.id] = computeElement(el); });

// ---------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------
let currentElementId = "H";
let clickIndex = 0; // 0 = solo el núcleo, sin saltos todavía
let nucleonLayoutCache = null; // posiciones (relativas, radio unidad) cacheadas por elemento
let shellAngles = []; // ángulo actual del electrón en cada capa (animación)

// Escala de la ESCALERA de comparación (DOM, no el diagrama). Empieza en
// BASE_PX (núcleo cómodo de ver) y, la PRIMERA vez que una línea nueva no
// cabe en el ancho visible, se reduce de una vez para siempre a 1px: a
// partir de ahí todas las líneas se dibujan a escala real (×10 exacto,
// sin más compresión) y el contenedor scrollea horizontalmente lo que
// haga falta. Ese scroll larguísimo es deliberado: es lo que transmite
// la distancia real entre el núcleo y el átomo completo.
let ladderScalePx = BASE_PX;

const uiCache = { theme: "dark" };
let diagramCx = 0, diagramCy = 0, diagramMaxRadiusPx = 0; // geometría del diagrama, recalculada en resize

// =====================================================================
// Utilidades numéricas y de formato (mismas convenciones que el resto de la colección)
// =====================================================================

const SUPERSCRIPT_MAP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] !== undefined ? SUPERSCRIPT_MAP[ch] : ch).join("");
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

function categoryColor(entry) {
  return uiCache.theme === "light" ? entry.light : entry.dark;
}
function rgbStr(arr, alpha) {
  return alpha === undefined ? "rgb(" + arr.join(",") + ")" : "rgba(" + arr.join(",") + "," + alpha + ")";
}

// =====================================================================
// Lógica del viaje de zoom: líneas, capas reveladas y reescalado
// =====================================================================

function getElement() { return ELEMENT_DATA[currentElementId]; }

// Diámetro real (m) que representa la línea del salto i (i=0 → el propio núcleo).
function lineDiameterM(el, i) { return el.nucleusDiameterM * Math.pow(10, i); }

function maxClickIndex(el) {
  // El recorrido termina en el salto que alcanza (o supera) la capa más externa.
  const outerDiam = el.shellDiametersM[el.shellDiametersM.length - 1];
  let i = 0;
  while (lineDiameterM(el, i) < outerDiam && i < 30) i++;
  return i;
}

// Para cada salto 0..clickIndex, qué capas (índices) se revelan EN ESE salto exactamente.
function buildRevealMap(el, upToIndex) {
  const revealed = new Set();
  const revealAt = []; // revealAt[i] = [índices de capa revelados en el salto i]
  for (let i = 0; i <= upToIndex; i++) {
    const diam = lineDiameterM(el, i);
    const newly = [];
    el.shellDiametersM.forEach((d, s) => {
      if (d <= diam && !revealed.has(s)) { revealed.add(s); newly.push(s); }
    });
    revealAt.push(newly);
  }
  return { revealed, revealAt };
}

// Factor de compresión k: la mínima potencia de 10 tal que la línea más nueva
// (clickIndex) quepa dentro de maxPx. Todas las líneas usan el mismo k.
function computeK(el, upToIndex, maxPx) {
  const rawPx = BASE_PX * Math.pow(10, upToIndex);
  let k = 0;
  while (rawPx / Math.pow(10, k) > maxPx && k < 30) k++;
  return k;
}

function realToRawPx(el, lengthM) { return (lengthM / el.nucleusDiameterM) * BASE_PX; }
function realToDisplayPx(el, lengthM, k) { return realToRawPx(el, lengthM) / Math.pow(10, k); }

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
  resetJourney(); // construye el estado inicial y pinta el panel lateral + escalera
}

function windowResized() {
  const holder = document.getElementById("canvas-holder");
  if (!holder) return;
  resizeCanvas(holder.offsetWidth, holder.offsetHeight);
  recomputeLayout();
}

function recomputeLayout() {
  diagramCx = width / 2;
  diagramCy = height / 2;
  diagramMaxRadiusPx = Math.max(20, Math.min(width, height) / 2 - 28);
}

function draw() {
  const theme = uiCache.theme;
  background(theme === "light" ? [248, 250, 252] : theme === "high-contrast" ? [0, 0, 0] : [11, 12, 16]);

  const el = getElement();
  // k se calibra al valor REAL del salto actual (línea ×10^clickIndex), no al
  // tamaño de lo que ya se ha revelado: así el núcleo encoge visiblemente en
  // CADA clic (coherente con la etiqueta "Salto ×10ⁱ"), aunque eso signifique
  // que una capa pequeña recién revelada se vea con margen alrededor — eso es
  // correcto: si el salto actual ya "se pasó" de su tamaño, debe verse pequeña.
  const k = computeK(el, clickIndex, diagramMaxRadiusPx * 2);
  const { revealed } = buildRevealMap(el, clickIndex);

  drawShellOrbits(theme, el, revealed, k);
  drawNucleus(theme, el, k);
  drawJourneyLabel(theme, el, k);
}

// =====================================================================
// Diagrama de Rutherford
// =====================================================================

// Empaquetado tipo "espiral de girasol" (Vogel): reparte N puntos en un
// círculo de forma uniforme y estable (no aleatoria), ideal para un
// racimo de nucleones que no se reordene entre fotogramas.
function buildNucleonLayout(el) {
  const total = el.A;
  const golden = Math.PI * (3 - Math.sqrt(5)); // ángulo dorado
  const types = [];
  for (let i = 0; i < el.Z; i++) types.push("p");
  for (let i = 0; i < el.N; i++) types.push("n");
  // Orden estable pero entremezclado (no agrupa todos los protones juntos),
  // usando un generador determinista (sin Math.random) para que sea reproducible.
  let seed = el.Z * 1000 + el.A;
  function nextRand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = types[i]; types[i] = types[j]; types[j] = tmp;
  }
  const points = types.map((type, i) => {
    const r = Math.sqrt((i + 0.5) / total); // radio normalizado (0..1)
    const theta = i * golden;
    return { type, x: r * Math.cos(theta), y: r * Math.sin(theta) };
  });
  return points;
}

function getNucleonLayout(el) {
  if (!nucleonLayoutCache || nucleonLayoutCache.id !== el.id) {
    nucleonLayoutCache = { id: el.id, points: buildNucleonLayout(el) };
  }
  return nucleonLayoutCache.points;
}

const NUCLEUS_DETAIL_MIN_PX = 10; // por debajo de este diámetro, se dibuja como punto único

function drawNucleus(theme, el, k) {
  const diamPx = Math.max(realToDisplayPx(el, el.nucleusDiameterM, k), 0.4);
  push();
  if (diamPx < NUCLEUS_DETAIL_MIN_PX) {
    // Demasiado pequeño para distinguir nucleones: un punto de color mixto.
    noStroke();
    fill(rgbStr(categoryColor(NUCLEUS_COLOR)));
    circle(diagramCx, diagramCy, Math.max(diamPx, 2));
  } else {
    const points = getNucleonLayout(el);
    const radiusPx = diamPx / 2;
    // 0.85·R/√A: aproximación estándar de empaquetado en espiral (área disponible ≈ R²/A
    // por nucleón); con factor 1 se solaparían entre sí, con >1 (como un 1.5 anterior)
    // un solo nucleón llegaba a salirse del propio círculo del núcleo.
    const dotR = Math.min(radiusPx, Math.max(1.1, (radiusPx / Math.sqrt(el.A)) * 0.85));
    noStroke();
    for (const p of points) {
      fill(p.type === "p" ? color(PROTON_COLOR[0], PROTON_COLOR[1], PROTON_COLOR[2]) : color(NEUTRON_COLOR[0], NEUTRON_COLOR[1], NEUTRON_COLOR[2]));
      circle(diagramCx + p.x * radiusPx, diagramCy + p.y * radiusPx, dotR * 2);
    }
  }
  pop();
}

function drawShellOrbits(theme, el, revealed, k) {
  push();
  noFill();
  // Avanza la animación de los electrones revelados.
  while (shellAngles.length < el.shellDiametersM.length) shellAngles.push(random(TWO_PI));
  el.shellDiametersM.forEach((diamM, s) => {
    if (!revealed.has(s)) return;
    const diamPx = realToDisplayPx(el, diamM, k);
    const radiusPx = diamPx / 2;
    const col = categoryColor(SHELL_COLORS[s % SHELL_COLORS.length]);
    stroke(col[0], col[1], col[2], 150);
    strokeWeight(1.4);
    circle(diagramCx, diagramCy, diamPx);

    // Velocidad angular decreciente para capas más externas (más realista: más lentas).
    shellAngles[s] += (0.9 / Math.sqrt(s + 1)) * (deltaTime / 1000);
    const ex = diagramCx + radiusPx * Math.cos(shellAngles[s]);
    const ey = diagramCy + radiusPx * Math.sin(shellAngles[s]);
    noStroke();
    fill(col[0], col[1], col[2]);
    circle(ex, ey, 7);

    // Etiqueta de la capa, junto a su órbita (a la derecha, si cabe en el lienzo).
    if (radiusPx > 14) {
      textAlign(LEFT, CENTER);
      textSize(10.5);
      fill(col[0], col[1], col[2]);
      const lx = Math.min(diagramCx + radiusPx + 6, width - 30);
      text("Capa " + SHELL_NAMES[s], lx, diagramCy - radiusPx + 8);
    }
  });
  pop();
}

function drawJourneyLabel(theme, el, k) {
  const diamM = lineDiameterM(el, clickIndex);
  const label = "Salto ×10" + toSuperscript(clickIndex) + "  ·  " + formatLength(diamM);
  push();
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  textSize(13);
  const tw = textWidth(label) + 18;
  const bx = constrain(diagramCx - tw / 2, 4, width - tw - 4);
  const by = 14;
  noStroke();
  fill(theme === "light" ? color(255, 255, 255, 235) : color(22, 26, 42, 235));
  rect(bx, by, tw, 24, 6);
  stroke(theme === "light" ? color(203, 213, 225) : color(55, 65, 95));
  strokeWeight(1);
  noFill();
  rect(bx, by, tw, 24, 6);
  noStroke();
  fill(theme === "light" ? color(30, 41, 59) : color(226, 232, 240));
  textStyle(NORMAL);
  text(label, bx + tw / 2, by + 5);
  pop();
}

// =====================================================================
// Panel lateral: datos del elemento, progreso, escalera de comparación (DOM)
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
    ["Capas electrónicas", el.shells.length + " (" + el.shells.map((c, i) => SHELL_NAMES[i] + ":" + c).join(", ") + ")"],
  ];
  box.innerHTML = rows.map((r) => '<div class="fact-row"><span>' + r[0] + '</span><span class="fact-value">' + r[1] + "</span></div>").join("");
}

function renderJourneyProgress() {
  const el = getElement();
  const total = maxClickIndex(el);
  const fill = document.getElementById("ui-progress-fill");
  const text = document.getElementById("ui-progress-text");
  const pct = total === 0 ? 100 : Math.round((clickIndex / total) * 100);
  if (fill) fill.style.width = pct + "%";
  if (text) text.innerText = "Salto " + clickIndex + " de " + total + (clickIndex >= total ? " · recorrido completo" : "");

  const btn = document.getElementById("ui-btn-zoom-out");
  if (btn) {
    const complete = clickIndex >= total;
    btn.disabled = complete;
    btn.innerHTML = complete ? "✓ Recorrido completo" : "➖ Quitar zoom (×10)";
  }
}

function renderLadder() {
  const el = getElement();
  const section = document.getElementById("ladder-section");
  if (clickIndex === 0) {
    section.innerHTML = '<p class="ladder-empty">Pulsa "Quitar zoom" para empezar a comparar tamaños.</p>';
    ladderScalePx = BASE_PX; // por si se vuelve a 0 desde "reiniciar"
    return;
  }

  // ¿La línea que se acaba de añadir sigue cabiendo, a la escala "cómoda"
  // actual, en el ancho visible (sin contar la etiqueta fija de la izquierda)?
  // Si no cabe Y todavía no hemos reducido nunca, se reduce la PRIMERA línea
  // a 1px de una vez para siempre: desde ahí todo se dibuja a escala real
  // (×10 exacto) y el contenedor scrollea en horizontal lo que haga falta.
  const labelColPx = 160;
  const visibleBudgetPx = Math.max(120, (section.clientWidth || 700) - labelColPx);
  const newestRawPx = ladderScalePx * Math.pow(10, clickIndex);
  if (ladderScalePx === BASE_PX && newestRawPx > visibleBudgetPx) {
    ladderScalePx = 1;
  }

  const { revealAt } = buildRevealMap(el, clickIndex);

  let html = "";
  for (let i = 0; i <= clickIndex; i++) {
    const diamM = lineDiameterM(el, i);
    const barPx = Math.max(ladderScalePx * Math.pow(10, i), 1);
    const shellsHere = revealAt[i] || [];
    // Nota: variable nombrada "barColor" a propósito (no "color") para no
    // ensombrear la función global color() de p5 dentro de este archivo.
    let barColor, shellLabel;
    if (i === 0) {
      barColor = categoryColor(NUCLEUS_COLOR);
      shellLabel = "Núcleo";
    } else if (shellsHere.length > 0) {
      barColor = categoryColor(SHELL_COLORS[shellsHere[0] % SHELL_COLORS.length]);
      shellLabel = shellsHere.map((s) => SHELL_NAMES[s]).join("+");
    } else {
      barColor = categoryColor(NEUTRAL_STEP_COLOR);
      shellLabel = "×10" + toSuperscript(i);
    }
    html +=
      '<div class="ladder-row">' +
      '<span class="ladder-row-label"><span class="ladder-row-swatch" style="background:' + rgbStr(barColor) + '"></span>' +
      (i === 0 ? "Núcleo" : "×10" + toSuperscript(i) + (shellsHere.length ? ' <span class="ladder-row-shells">→ ' + shellLabel + "</span>" : "")) +
      "</span>" +
      '<span class="ladder-row-bar" style="width:' + barPx + "px; background:" + rgbStr(barColor) + ';"></span>' +
      '<span class="ladder-row-value">' + formatLength(diamM) + "</span>" +
      "</div>";
  }
  section.innerHTML = html;
  section.scrollLeft = section.scrollWidth; // salta directamente a ver la línea más nueva
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
  shellAngles = [];
  ladderScalePx = BASE_PX;
  refreshAll();
}

function setupUIEventListeners() {
  document.getElementById("ui-element-select").addEventListener("change", (e) => {
    currentElementId = e.target.value;
    resetJourney();
  });

  document.getElementById("ui-btn-zoom-out").addEventListener("click", () => {
    const el = getElement();
    const total = maxClickIndex(el);
    if (clickIndex < total) {
      clickIndex++;
      refreshAll();
    }
  });

  document.getElementById("ui-btn-reset").addEventListener("click", () => {
    resetJourney();
  });

  const infoCard = document.getElementById("ui-panel-info");
  document.getElementById("ui-info-trigger").addEventListener("click", () => {
    infoCard.classList.toggle("is-expanded");
  });

  window.addEventListener("resize", () => { renderLadder(); });
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
