// =====================================================================
// Tamaño real del átomo — zoom logarítmico continuo de 30 m a 1,7 fm.
//
// Idea central: el "marco de visión" (círculo central) tiene SIEMPRE el
// mismo tamaño en píxeles. Lo que cambia al mover el control es cuántos
// metros reales representa ese marco (frameDiameterM = 10^exponent).
// Dentro de él se dibuja, a escala real, el objeto conocido más grande
// que aún cabe (círculo sólido) y, asomando por el borde, el siguiente
// objeto ya demasiado grande para caber (círculo discontinuo). Esto
// evita saltos visuales: en el instante en que un objeto deja de caber,
// su tamaño en píxeles coincide exactamente con el del marco.
// =====================================================================

// ---------------------------------------------------------------------
// Catálogo de referencias (diámetro real en metros). `nucleusSize`, solo
// presente en átomos, es el diámetro real de su núcleo: coincide a
// propósito con el de la entrada "subatomico" correspondiente (p.ej. el
// de "h-atomo" coincide con "h-nucleo"), para que el botón "Mostrar
// núcleo a escala" no contradiga lo que se ve al saltar a esa entrada.
// ---------------------------------------------------------------------
const RAW_BENCHMARKS = [
  { id: "edificio", name: "Edificio de 10 plantas", size: 30, cat: "macro" },
  { id: "persona", name: "Persona adulta", size: 1.70, cat: "macro" },
  { id: "balon", name: "Balón de fútbol", size: 0.22, cat: "macro" },
  { id: "moneda", name: "Moneda de 1 €", size: 0.023, cat: "macro" },
  { id: "arroz", name: "Grano de arroz", size: 0.007, cat: "macro" },
  { id: "hormiga", name: "Hormiga", size: 0.005, cat: "macro" },
  { id: "arena", name: "Grano de arena", size: 0.0006, cat: "macro" },
  { id: "cabello", name: "Grosor de un cabello", size: 0.00007, cat: "micro" },
  { id: "globulo", name: "Glóbulo rojo", size: 0.000008, cat: "micro" },
  { id: "bacteria", name: "Bacteria (E. coli)", size: 0.000002, cat: "micro" },
  { id: "mitocondria", name: "Mitocondria", size: 0.000001, cat: "micro" },
  { id: "luzvisible", name: "Longitud de onda de la luz verde", size: 0.00000055, cat: "micro" },
  { id: "virus", name: "Virus de la gripe", size: 0.0000001, cat: "micro" },
  { id: "ribosoma", name: "Ribosoma", size: 0.000000025, cat: "molecular" },
  { id: "adn", name: "Doble hélice de ADN", size: 0.000000002, cat: "molecular" },
  { id: "glucosa", name: "Molécula de glucosa", size: 0.0000000008, cat: "molecular" },
  { id: "agua", name: "Molécula de agua", size: 0.000000000275, cat: "molecular" },
  { id: "h-atomo", name: "Átomo de hidrógeno", size: 0.000000000106, cat: "atomico", nucleusSize: 0.0000000000000017 },
  { id: "c-atomo", name: "Átomo de carbono", size: 0.00000000014, cat: "atomico", nucleusSize: 0.0000000000000060 },
  { id: "au-atomo", name: "Átomo de oro", size: 0.000000000288, cat: "atomico", nucleusSize: 0.000000000000014 },
  { id: "c-nucleo", name: "Núcleo de carbono", size: 0.0000000000000060, cat: "subatomico" },
  { id: "h-nucleo", name: "Núcleo de hidrógeno (protón)", size: 0.0000000000000017, cat: "subatomico" },
];
// Orden ascendente por tamaño: la lógica de "qué cabe en el marco" lo asume.
const BENCHMARKS = RAW_BENCHMARKS.slice().sort((a, b) => a.size - b.size);

const CATEGORY_LABELS = {
  macro: "Macroscópico",
  micro: "Microscópico (células y virus)",
  molecular: "Molecular",
  atomico: "Atómico",
  subatomico: "Subatómico (núcleos)",
};
const CATEGORY_COLORS = {
  macro: { dark: [245, 158, 11], light: [180, 110, 5] },
  micro: { dark: [16, 185, 129], light: [6, 120, 80] },
  molecular: { dark: [139, 92, 246], light: [100, 50, 200] },
  atomico: { dark: [59, 130, 246], light: [26, 82, 190] },
  subatomico: { dark: [239, 68, 68], light: [190, 30, 30] },
};

const PERSON_SIZE_M = 1.70;
const HYDROGEN_ATOM = BENCHMARKS.find((b) => b.id === "h-atomo");
const DEFAULT_EXPONENT = Math.log10(HYDROGEN_ATOM.size);
const MIN_EXPONENT = -15.3;
const MAX_EXPONENT = 1.7;

// ---------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------
let exponent = DEFAULT_EXPONENT;       // log10(metros que abarca el marco)
let targetExponent = null;             // si no es null, animamos hacia él
let isTouring = false;
const TOUR_DURATION_MS = 26000;        // recorrido completo edificio -> núcleo

let showNucleus = false;
let frameDiameterPx = 0;               // tamaño fijo del marco, calculado en setup/resize

// Eje de escalas (regla inferior)
let axisRect = { x: 0, y: 0, w: 0, h: 0 };
let isDraggingAxis = false;

const uiCache = { theme: "dark" };

// =====================================================================
// Utilidades numéricas y de formato
// =====================================================================

function clampExponent(e) {
  return constrain(e, MIN_EXPONENT, MAX_EXPONENT);
}

const SUPERSCRIPT_MAP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] !== undefined ? SUPERSCRIPT_MAP[ch] : ch).join("");
}

// Redondea a `sig` cifras significativas y devuelve un string en formato español (coma decimal).
function formatSig(value, sig) {
  if (value === 0) return "0";
  const rounded = parseFloat(value.toPrecision(sig));
  // Hasta 999 con decimales si los necesita; evita notación exponencial de toPrecision en nº pequeños.
  let s = Math.abs(rounded) >= 1
    ? rounded.toLocaleString("es-ES", { maximumFractionDigits: Math.max(0, sig - String(Math.trunc(Math.abs(rounded))).length) })
    : rounded.toString().replace(".", ",");
  return s;
}

// Convierte una longitud en metros a la unidad más legible (m, cm, mm, µm, nm, pm, fm).
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

// Expresa un número grande/pequeño como "N veces" (coloquial) o "m × 10^n veces" (científico).
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

// Devuelve "X veces más grande/pequeño que <referencia>" comparando dos tamaños en metros.
function compareSizes(sizeM, referenceM) {
  const ratio = sizeM / referenceM;
  if (ratio > 0.97 && ratio < 1.03) return "prácticamente del mismo tamaño";
  if (ratio >= 1) return formatTimes(ratio) + " más grande";
  return formatTimes(1 / ratio) + " más pequeño";
}

function categoryColor(cat) {
  const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.atomico;
  return uiCache.theme === "light" ? c.light : c.dark;
}

// =====================================================================
// Lógica de "qué cabe en el marco"
// =====================================================================

// Dado el diámetro actual del marco (en metros), devuelve:
//  - inner: el benchmark más grande que cabe completo (o null si ninguno cabe)
//  - outer: el siguiente benchmark, ya más grande que el marco (o null si no hay)
function findFitting(frameDiameterM) {
  let inner = null;
  let outer = null;
  for (let i = 0; i < BENCHMARKS.length; i++) {
    if (BENCHMARKS[i].size <= frameDiameterM) inner = BENCHMARKS[i];
    else { outer = BENCHMARKS[i]; break; }
  }
  return { inner, outer };
}

// =====================================================================
// p5 — ciclo de vida
// =====================================================================

function setup() {
  const holder = document.getElementById("canvas-holder");
  const w = holder && holder.offsetWidth ? holder.offsetWidth : 870;
  const h = holder && holder.offsetHeight ? holder.offsetHeight : 686;
  const canvas = createCanvas(w, h);
  canvas.parent("canvas-holder");
  recomputeLayout();
  setupAppearanceEventListeners();
  setupUIEventListeners();
  buildQuickJumpList();
  syncSliderFromExponent(); // alinea el slider con el valor exacto de DEFAULT_EXPONENT
  updateSidePanel();
}

function windowResized() {
  const holder = document.getElementById("canvas-holder");
  if (!holder) return;
  resizeCanvas(holder.offsetWidth, holder.offsetHeight);
  recomputeLayout();
}

// Calcula el tamaño fijo del marco y el rectángulo del eje de escalas
// en función del tamaño actual del lienzo.
function recomputeLayout() {
  const axisH = constrain(Math.round(height * 0.16), 56, 96);
  axisRect = { x: 14, y: height - axisH - 10, w: width - 28, h: axisH };
  const mainAreaH = height - axisH - 20;
  frameDiameterPx = Math.round(Math.min(width, mainAreaH) * 0.62);
}

function draw() {
  const theme = uiCache.theme;
  background(theme === "light" ? [248, 250, 252] : theme === "high-contrast" ? [0, 0, 0] : [11, 12, 16]);

  advanceAnimation();

  const frameDiameterM = Math.pow(10, exponent);
  const pixelsPerMeter = frameDiameterPx / frameDiameterM;
  const { inner, outer } = findFitting(frameDiameterM);

  const cx = width / 2;
  const cy = (height - axisRect.h - 20) / 2 + 10;

  drawOuterObject(theme, cx, cy, outer, pixelsPerMeter);
  drawFrame(theme, cx, cy, frameDiameterM);
  drawInnerObject(theme, cx, cy, inner, pixelsPerMeter);
  drawEmptyStateMessages(theme, cx, cy, inner, outer);
  if (showNucleus && inner && inner.nucleusSize) drawNucleus(theme, cx, cy, inner, pixelsPerMeter);

  drawAxis(theme);
}

// Avanza la animación de "ir hacia un objetivo" (saltos rápidos) o el recorrido automático.
function advanceAnimation() {
  if (isTouring) {
    const speed = (MAX_EXPONENT - MIN_EXPONENT) / (TOUR_DURATION_MS / 1000);
    exponent -= speed * (deltaTime / 1000);
    if (exponent <= MIN_EXPONENT) {
      exponent = MIN_EXPONENT;
      isTouring = false;
      setTourButtonState(false);
    }
    syncSliderFromExponent();
    updateSidePanel();
    return;
  }
  if (targetExponent !== null) {
    const diff = targetExponent - exponent;
    if (Math.abs(diff) < 0.01) {
      exponent = targetExponent;
      targetExponent = null;
    } else {
      exponent += diff * Math.min(1, deltaTime / 180);
    }
    syncSliderFromExponent();
    updateSidePanel();
  }
}

function syncSliderFromExponent() {
  const slider = document.getElementById("ui-exponent-slider");
  if (slider) slider.value = exponent.toFixed(3);
  updateFrameSizeReadout();
}

// =====================================================================
// Dibujo
// =====================================================================

function drawFrame(theme, cx, cy, frameDiameterM) {
  push();
  noFill();
  stroke(theme === "light" ? color(58, 80, 104) : theme === "high-contrast" ? color(255, 255, 0) : color(63, 71, 106));
  strokeWeight(2);
  circle(cx, cy, frameDiameterPx);

  // Etiqueta del tamaño del marco, anclada a su borde inferior.
  const label = "Marco = " + formatLength(frameDiameterM);
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  textSize(12.5);
  const tw = textWidth(label) + 18;
  const bx = constrain(cx - tw / 2, 4, width - tw - 4);
  const by = cy + frameDiameterPx / 2 + 10;
  noStroke();
  fill(theme === "light" ? color(255, 255, 255, 235) : color(22, 26, 42, 235));
  rect(bx, by, tw, 22, 6);
  stroke(theme === "light" ? color(203, 213, 225) : color(55, 65, 95));
  strokeWeight(1);
  noFill();
  rect(bx, by, tw, 22, 6);
  noStroke();
  fill(theme === "light" ? color(30, 41, 59) : color(226, 232, 240));
  textStyle(NORMAL);
  text(label, bx + tw / 2, by + 4);
  pop();
}

function drawInnerObject(theme, cx, cy, inner, pixelsPerMeter) {
  if (!inner) return;
  const px = Math.max(inner.size * pixelsPerMeter, 1.5);
  const col = categoryColor(inner.cat);
  push();
  noStroke();
  fill(col[0], col[1], col[2], 195);
  circle(cx, cy, px);
  stroke(col[0], col[1], col[2]);
  strokeWeight(1.2);
  noFill();
  circle(cx, cy, px);

  // Etiqueta encima del marco (siempre en posición fija para que no se mueva con el zoom).
  drawTopLabel(theme, cx, cy, inner.name + "  ·  " + formatLength(inner.size), col, false);

  if (px < 3) {
    drawHint(theme, cx, cy, "(más pequeño que un píxel: se dibuja agrandado a tamaño mínimo)", 0);
  }
  pop();
}

function drawOuterObject(theme, cx, cy, outer, pixelsPerMeter) {
  if (!outer) return;
  const px = outer.size * pixelsPerMeter;
  if (px <= frameDiameterPx * 1.002) return; // por redondeo, evita un doble trazo con el marco
  const col = categoryColor(outer.cat);
  push();
  drawingContext.save();
  drawingContext.setLineDash([6, 6]);
  noFill();
  stroke(col[0], col[1], col[2], 200);
  strokeWeight(2);
  circle(cx, cy, Math.min(px, max(width, height) * 2.2)); // limita el radio para no desbordar el motor de canvas
  drawingContext.restore();
  pop();

  // Etiqueta del objeto que "no cabe", en la esquina superior derecha del lienzo.
  // En lienzos estrechos se omite el texto (colisionaría con la etiqueta central)
  // pero el círculo discontinuo, que es la parte esencial, se sigue mostrando.
  if (width < 560) return;
  const text1 = outer.name + " no cabe aquí";
  const text2 = "(mide " + formatLength(outer.size) + ")";
  push();
  textAlign(RIGHT, TOP);
  textStyle(BOLD);
  textSize(11.5);
  noStroke();
  fill(col[0], col[1], col[2]);
  text(text1, width - 16, 16);
  textStyle(NORMAL);
  textSize(10.5);
  fill(theme === "light" ? color(71, 85, 105) : color(148, 163, 184));
  text(text2, width - 16, 32);
  pop();
}

function drawTopLabel(theme, cx, cy, text1, col, dim) {
  push();
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  textSize(12.5);
  const tw = textWidth(text1) + 18;
  const bx = constrain(cx - tw / 2, 4, width - tw - 4);
  const by = 16;
  noStroke();
  fill(theme === "light" ? color(255, 255, 255, 235) : color(22, 26, 42, 235));
  rect(bx, by, tw, 24, 6);
  stroke(col[0], col[1], col[2], dim ? 120 : 255);
  strokeWeight(1.3);
  noFill();
  rect(bx, by, tw, 24, 6);
  noStroke();
  fill(col[0], col[1], col[2]);
  textStyle(NORMAL);
  text(text1, bx + tw / 2, by + 5);
  pop();
}

// `lane` separa verticalmente avisos que podrían coincidir en el mismo frame
// (p.ej. "objeto sub-píxel" y "núcleo sub-píxel" a la vez en pantallas muy pequeñas).
function drawHint(theme, cx, cy, text1, lane) {
  push();
  textAlign(CENTER, TOP);
  textSize(10.5);
  fill(theme === "light" ? color(100, 116, 139) : color(130, 140, 165));
  text(text1, cx, cy + frameDiameterPx / 2 + 38 + (lane || 0) * 16);
  pop();
}

function drawEmptyStateMessages(theme, cx, cy, inner, outer) {
  if (inner !== null) return; // hay objeto interior: no hace falta mensaje
  const boxW = frameDiameterPx * 0.8;
  const boxH = frameDiameterPx * 0.6;
  push();
  textAlign(CENTER, CENTER);
  textSize(12.5);
  fill(theme === "light" ? color(71, 85, 105) : color(148, 163, 184));
  textWrap(WORD);
  text(
    "Más allá de lo catalogado aquí: a este tamaño ni los protones tienen un borde definido (dominan los efectos cuánticos).",
    cx - boxW / 2, cy - boxH / 2, boxW, boxH
  );
  pop();
}

// Dibuja el núcleo a escala real dentro del átomo enfocado (cuando el usuario lo activa).
// Usa el mismo valor que el benchmark de núcleo correspondiente (p.ej. "h-nucleo"),
// para que el dato coincida exactamente con el que se ve al saltar a esa entrada.
function drawNucleus(theme, cx, cy, atomObj, pixelsPerMeter) {
  const nucleusDiameterM = atomObj.nucleusSize;
  const px = nucleusDiameterM * pixelsPerMeter;
  push();
  if (px < 1) {
    // El núcleo no llega a ocupar ni un píxel: mostramos un punto mínimo y lo decimos explícitamente.
    noStroke();
    fill(239, 68, 68);
    circle(cx, cy, 2);
    const neededZoom = (1 / pixelsPerMeter) / nucleusDiameterM;
    drawHint(theme, cx, cy, "El núcleo (" + formatLength(nucleusDiameterM) + ") no llega a 1 píxel: haría falta acercar " + formatTimes(neededZoom) + " más para verlo.", 1);
  } else {
    noStroke();
    fill(239, 68, 68, 230);
    circle(cx, cy, Math.max(px, 2));
    drawHint(theme, cx, cy, "Núcleo a escala: " + formatLength(nucleusDiameterM), 1);
  }
  pop();
}

// =====================================================================
// Eje de escalas (regla logarítmica inferior, -15.3 a 1.7)
// =====================================================================

function expToAxisX(e) {
  return map(e, MIN_EXPONENT, MAX_EXPONENT, axisRect.x, axisRect.x + axisRect.w);
}
function axisXToExp(x) {
  return map(x, axisRect.x, axisRect.x + axisRect.w, MIN_EXPONENT, MAX_EXPONENT);
}

function drawAxis(theme) {
  push();
  noStroke();
  fill(theme === "light" ? color(216, 223, 232) : color(20, 23, 35));
  rect(axisRect.x, axisRect.y, axisRect.w, axisRect.h, 8);

  const lineY = axisRect.y + axisRect.h * 0.42;
  stroke(theme === "light" ? color(140, 155, 175) : color(70, 80, 110));
  strokeWeight(1.5);
  line(axisRect.x + 6, lineY, axisRect.x + axisRect.w - 6, lineY);

  // Marcas de cada potencia de diez.
  textAlign(CENTER, TOP);
  textSize(9.5);
  for (let e = Math.ceil(MIN_EXPONENT); e <= Math.floor(MAX_EXPONENT); e++) {
    const x = expToAxisX(e);
    stroke(theme === "light" ? color(140, 155, 175) : color(70, 80, 110));
    strokeWeight(1);
    line(x, lineY - 4, x, lineY + 4);
    noStroke();
    fill(theme === "light" ? color(90, 105, 125) : color(120, 130, 160));
    text("10" + toSuperscript(e), x, lineY + 7);
  }

  // Puntos de cada benchmark + etiqueta solo si está cerca del punto de vista actual
  // (evita amontonar 21 textos en ~900px de ancho).
  for (const b of BENCHMARKS) {
    const e = Math.log10(b.size);
    if (e < MIN_EXPONENT || e > MAX_EXPONENT) continue;
    const x = expToAxisX(e);
    const col = categoryColor(b.cat);
    noStroke();
    fill(col[0], col[1], col[2]);
    circle(x, lineY, 7);
    if (Math.abs(e - exponent) < 2.6) {
      push();
      translate(x, lineY - 8);
      rotate(-PI / 2.6);
      textAlign(LEFT, CENTER);
      textSize(9);
      fill(theme === "light" ? color(60, 75, 95) : color(190, 198, 215));
      text(b.name, 0, 0);
      pop();
    }
  }

  // Indicador (triángulo) de la posición actual.
  const px = expToAxisX(exponent);
  noStroke();
  fill(theme === "high-contrast" ? color(255, 255, 0) : color(59, 130, 246));
  triangle(px - 7, axisRect.y + axisRect.h - 4, px + 7, axisRect.y + axisRect.h - 4, px, axisRect.y + axisRect.h - 17);
  pop();
}

// =====================================================================
// Interacción de ratón con el eje
// =====================================================================

function isInsideAxis(x, y) {
  return x >= axisRect.x && x <= axisRect.x + axisRect.w && y >= axisRect.y && y <= axisRect.y + axisRect.h;
}

function mousePressed() {
  if (isInsideAxis(mouseX, mouseY)) {
    isDraggingAxis = true;
    setExponentFromAxisClick(mouseX);
  }
}
function mouseDragged() {
  if (isDraggingAxis) setExponentFromAxisClick(mouseX);
}
function mouseReleased() {
  isDraggingAxis = false;
}

function setExponentFromAxisClick(x) {
  cancelAnimationsAndTour();
  // Si el clic cae cerca de un benchmark, ajustamos exactamente a su tamaño (clic preciso).
  // En modo táctil ampliamos el radio de "imán" para compensar dedos menos precisos que un cursor.
  const isTouchUi = document.documentElement.getAttribute("data-ui") === "touch";
  let snapped = null;
  let bestDist = isTouchUi ? 22 : 14; // píxeles de tolerancia
  for (const b of BENCHMARKS) {
    const e = Math.log10(b.size);
    if (e < MIN_EXPONENT || e > MAX_EXPONENT) continue;
    const bx = expToAxisX(e);
    const d = Math.abs(bx - x);
    if (d < bestDist) { bestDist = d; snapped = e; }
  }
  exponent = clampExponent(snapped !== null ? snapped : axisXToExp(x));
  syncSliderFromExponent();
  updateSidePanel();
}

// =====================================================================
// Panel lateral (DOM): comparación, núcleo, lista "saltar a..."
// =====================================================================

function updateFrameSizeReadout() {
  const el = document.getElementById("frame-size-val");
  if (el) el.innerText = formatLength(Math.pow(10, exponent));
}

function updateSidePanel() {
  updateFrameSizeReadout();
  const frameDiameterM = Math.pow(10, exponent);
  const { inner, outer } = findFitting(frameDiameterM);
  const focus = inner || outer; // si nada cabe, usamos el más pequeño conocido como referencia

  const box = document.getElementById("comparison-text");
  if (box) {
    if (!focus) {
      box.innerHTML = '<p class="comparison-line is-muted">Sin referencias en este rango.</p>';
    } else {
      const lines = [];
      lines.push("Estás viendo: <strong>" + focus.name + "</strong> (" + formatLength(focus.size) + ")");
      lines.push("Es " + compareSizes(focus.size, PERSON_SIZE_M) + " que una persona (1,70 m)");
      if (focus.id !== "h-atomo") {
        lines.push("Es " + compareSizes(focus.size, HYDROGEN_ATOM.size) + " que un átomo de hidrógeno");
      }
      // Caso especial: el marco cabe dentro de un núcleo pero ya no dentro de ningún átomo
      // catalogado → es justo el hueco vacío entre el núcleo y la nube electrónica.
      if (inner && inner.cat === "subatomico" && outer && outer.cat === "atomico") {
        lines.push('<span class="comparison-line-highlight">Estás en el espacio vacío del átomo: más grande que el núcleo, pero aún muy lejos del tamaño del átomo completo.</span>');
      }
      box.innerHTML = lines.map((l) => '<p class="comparison-line">' + l + "</p>").join("");
    }
  }

  // Activa/desactiva el interruptor de núcleo según si el objeto enfocado es un átomo.
  const nucleusRow = document.getElementById("ui-nucleus-row");
  const nucleusCheckbox = document.getElementById("ui-nucleus-toggle");
  const isAtomFocus = !!(inner && inner.nucleusSize);
  if (nucleusRow) nucleusRow.classList.toggle("is-disabled", !isAtomFocus);
  if (nucleusCheckbox) {
    nucleusCheckbox.disabled = !isAtomFocus;
    if (!isAtomFocus) { nucleusCheckbox.checked = false; showNucleus = false; }
  }

  refreshQuickJumpHighlight(inner);
}

function buildQuickJumpList() {
  const container = document.getElementById("quickjump-list");
  if (!container) return;
  const order = ["macro", "micro", "molecular", "atomico", "subatomico"];
  let html = "";
  for (const cat of order) {
    const items = BENCHMARKS.filter((b) => b.cat === cat);
    if (items.length === 0) continue;
    html += '<div class="quickjump-cat-label">' + CATEGORY_LABELS[cat] + "</div>";
    for (const b of items) {
      const col = categoryColor(b.cat);
      html +=
        '<button class="quickjump-btn" data-id="' + b.id + '" type="button">' +
        '<span class="quickjump-dot" style="background: rgb(' + col.join(",") + ')"></span>' +
        '<span class="quickjump-name">' + b.name + "</span>" +
        '<span class="quickjump-size">' + formatLength(b.size) + "</span>" +
        "</button>";
    }
  }
  container.innerHTML = html;
  container.querySelectorAll(".quickjump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = BENCHMARKS.find((x) => x.id === btn.dataset.id);
      if (!b) return;
      cancelAnimationsAndTour();
      targetExponent = clampExponent(Math.log10(b.size));
    });
  });
}

function refreshQuickJumpHighlight(currentInner) {
  const container = document.getElementById("quickjump-list");
  if (!container) return;
  container.querySelectorAll(".quickjump-btn").forEach((btn) => {
    btn.classList.toggle("is-current", !!currentInner && btn.dataset.id === currentInner.id);
  });
}

// =====================================================================
// Controles de UI
// =====================================================================

function cancelAnimationsAndTour() {
  targetExponent = null;
  if (isTouring) { isTouring = false; setTourButtonState(false); }
}

function setTourButtonState(active) {
  const btn = document.getElementById("ui-btn-tour");
  if (!btn) return;
  btn.classList.toggle("is-active", active);
  btn.innerHTML = active ? "❚❚ Pausa" : "▶ Recorrido";
}

function setupUIEventListeners() {
  const slider = document.getElementById("ui-exponent-slider");
  slider.addEventListener("input", (e) => {
    cancelAnimationsAndTour();
    exponent = clampExponent(parseFloat(e.target.value));
    updateFrameSizeReadout();
    updateSidePanel();
  });

  document.getElementById("ui-btn-zoom-in").addEventListener("click", () => {
    cancelAnimationsAndTour();
    targetExponent = clampExponent(exponent - 1);
  });
  document.getElementById("ui-btn-zoom-out").addEventListener("click", () => {
    cancelAnimationsAndTour();
    targetExponent = clampExponent(exponent + 1);
  });

  document.getElementById("ui-btn-tour").addEventListener("click", () => {
    targetExponent = null;
    isTouring = !isTouring;
    setTourButtonState(isTouring);
    if (isTouring && exponent <= MIN_EXPONENT + 0.05) exponent = MAX_EXPONENT; // si ya estabas al final, reinicia el recorrido
  });

  document.getElementById("ui-nucleus-toggle").addEventListener("change", (e) => {
    showNucleus = e.target.checked;
  });

  document.getElementById("ui-btn-reset").addEventListener("click", () => {
    cancelAnimationsAndTour();
    targetExponent = DEFAULT_EXPONENT;
    showNucleus = false;
    const cb = document.getElementById("ui-nucleus-toggle");
    if (cb) cb.checked = false;
  });

  const infoCard = document.getElementById("ui-panel-info");
  document.getElementById("ui-info-trigger").addEventListener("click", () => {
    infoCard.classList.toggle("is-expanded");
  });
  const qjCard = document.getElementById("ui-panel-quickjump");
  document.getElementById("ui-quickjump-trigger").addEventListener("click", () => {
    qjCard.classList.toggle("is-expanded");
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
    buildQuickJumpList();
    updateSidePanel();
  });

  const densitySelect = document.getElementById("ui-density-select");
  const curDensity = root.getAttribute("data-ui") || "compact";
  if (densitySelect) {
    densitySelect.value = curDensity;
    densitySelect.addEventListener("change", (e) => {
      root.setAttribute("data-ui", e.target.value);
      try { localStorage.setItem("sim-ui-density", e.target.value); } catch (err) {}
      windowResized();
    });
  }
}
