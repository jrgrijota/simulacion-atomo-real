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

// Colores de la flecha de referencia para cada salto de zoom-out (índice = clickIndex)
const ZOOM_ARROW_COLORS = [
  null, // índice 0 → se usa accentColor (azul)
  { dark: [251, 146, 60],  light: [190,  95, 20] },  // 1 naranja
  { dark: [52,  211, 153], light: [10,  140, 80] },  // 2 esmeralda
  { dark: [6,   182, 212], light: [12,  120,150] },  // 3 cian
  { dark: [168,  85, 247], light: [120,  40,190] },  // 4 violeta
  { dark: [244,  63,  94], light: [180,  20, 60] },  // 5 rosa
  { dark: [20,  184, 166], light: [10,  120,110] },  // 6 teal
  { dark: [234, 179,   8], light: [160, 120,  5] },  // 7 amarillo
];

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
let clickIndex = 0; // nº de saltos de zoom-out realizados
let nucleonLayoutCache = null;
let nucleonAnim = null; // { elementId, particles: [{x,y,vx,vy,type}] } coords normalizadas (1 = nucleusR)
let electronAngles = [];
let ladderScalePx = BASE_PX;

// Animación de zoom continua
let zoomAnimT = 0;    // progreso lineal 0→1 del paso actual
let zoomAnimDir = 0;  // +1 = alejando, -1 = acercando, 0 = en reposo
const ZOOM_DURATION = 0.75; // segundos por paso de zoom

const uiCache = { theme: "dark" };
let _electronBoxH = 148; // altura real del recuadro de electrones, se actualiza cada frame
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
function diamLabel(m) {
  return "D = " + formatLength(m) + " = " + formatScientificM(m);
}

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
function zoomArrowColor(stepIndex) {
  const absIdx = Math.abs(stepIndex);
  if (absIdx === 0) return accentColor(uiCache.theme);
  const entry = ZOOM_ARROW_COLORS[absIdx % ZOOM_ARROW_COLORS.length] || ZOOM_ARROW_COLORS[1];
  return categoryColor(entry);
}

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
  if (theme === "light") return { bg: [221, 231, 242], border: [148, 168, 188], ink: [12, 26, 40] };
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

// Rectángulo del recuadro del núcleo (arriba-izquierda).
function nucleusInfoBoxRect() {
  const w = Math.min(252, Math.max(176, width * 0.36));
  return { x: 14, y: 20, w: w, h: 70 };
}
// Rectángulo del recuadro de electrones (arriba-derecha).
// La altura se actualiza cada frame desde drawElectronInfoBox() para que atomLayout()
// use la medida real y no una sobreestimación que reduzca innecesariamente atomR.
function electronInfoBoxRect() {
  const w = Math.min(155, Math.max(120, width * 0.18));
  return { x: width - w - 14, y: 20, w: w, h: _electronBoxH };
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
  const clearance = Math.min(
    pointRectDist(cx, cy, nucleusInfoBoxRect()),
    pointRectDist(cx, cy, electronInfoBoxRect())
  ) - 10;
  atomR = Math.max(24, Math.min(atomR, clearance));
  return { cx, cy, atomR };
}

function draw() {
  const theme = uiCache.theme;
  background(theme === "light" ? [248, 250, 252] : theme === "high-contrast" ? [0, 0, 0] : [11, 12, 16]);
  const el = getElement();

  // Avanzar animación de zoom
  if (zoomAnimDir !== 0) {
    zoomAnimT += deltaTime / 1000 / ZOOM_DURATION;
    if (zoomAnimT >= 1) {
      zoomAnimT = 0;
      clickIndex += zoomAnimDir;
      zoomAnimDir = 0;
      refreshAll();
    }
  }

  // Ease in-out cúbico para suavizar el movimiento
  const t = zoomAnimT;
  const easeT = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  const effectiveCI = clickIndex + zoomAnimDir * easeT;

  drawAtomView(theme, el, effectiveCI);

  const { cx, cy, atomR } = atomLayout();
  if ((el.nucleusDiameterM / el.atomDiameterM) * atomR / Math.pow(10, effectiveCI) < 0.5) {
    drawNucleusInfoBox(theme, cx, cy);
  }
  drawElectronInfoBox(theme, cx, cy, atomR, el, effectiveCI);
  if (zoomAnimDir === 0 && clickIndex === -maxClickIndex(el)) {
    drawNucleusReachedBox(theme, el);
  }
}

// =====================================================================
// Zona de simulación (paso 1): el átomo completo + cota del diámetro
// =====================================================================

function drawAtomView(theme, el, effectiveCI) {
  const { cx, cy, atomR } = atomLayout();
  const numShells = el.shells.length;

  const acc = accentColor(theme);
  const zoomFactor = Math.pow(10, effectiveCI);

  while (electronAngles.length < numShells) electronAngles.push(random(TWO_PI));

  // Relleno suave del interior del átomo (capa más externa visible).
  // Cuando todas las capas superan el lienzo (zoom muy alto), el interior
  // del átomo cubre toda la pantalla → se rellena el canvas completo.
  push();
  noStroke();
  fill(acc[0], acc[1], acc[2], 22);
  let atomFilled = false;
  for (let s = numShells - 1; s >= 0; s--) {
    const rs = atomR * (s + 1) / numShells / zoomFactor;
    if (rs > 0 && rs <= Math.max(width, height)) { circle(cx, cy, rs * 2); atomFilled = true; break; }
  }
  if (!atomFilled) rect(0, 0, width, height);
  pop();

  push();
  for (let s = 0; s < numShells; s++) {
    const rs = atomR * (s + 1) / numShells / zoomFactor;

    // Saltar capas que sobrepasarían el lienzo (zoom in)
    if (rs <= 0 || rs > width) {
      electronAngles[s] += (0.32 / Math.sqrt(s + 1)) * (deltaTime / 1000);
      continue;
    }

    noFill();
    stroke(acc[0], acc[1], acc[2], 150);
    strokeWeight(1.3);
    circle(cx, cy, rs * 2);

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

  drawNucleusOnCanvas(cx, cy, atomR, el, effectiveCI);
  drawDiameterCota(theme, cx, cy, atomR, el, effectiveCI);
}

// Núcleo en el centro del lienzo. Se dibuja solo cuando supera 1 px de diámetro.
// Con radio < 5 px: punto sólido. Con radio >= 5 px: nucleones individuales.
function drawNucleusOnCanvas(cx, cy, atomR, el, effectiveCI) {
  const nucleusR = (el.nucleusDiameterM / el.atomDiameterM) * atomR / Math.pow(10, effectiveCI);
  if (nucleusR < 0.5) return;

  const red = stepColor(0);

  if (!nucleonAnim || nucleonAnim.elementId !== el.id) initNucleonAnim(el);
  updateNucleonAnim(deltaTime / 1000);

  push();

  if (nucleusR < 5) {
    noStroke();
    fill(red[0], red[1], red[2]);
    circle(cx, cy, Math.max(1, nucleusR * 2));
  } else {
    // Circunferencia del núcleo
    stroke(red[0], red[1], red[2]);
    strokeWeight(1.5);
    noFill();
    circle(cx, cy, nucleusR * 2);

    // Nucleones animados
    const dotDiam = Math.max(2, Math.min(2 * nucleusR / Math.sqrt(el.A), 1.8 * nucleusR));
    noStroke();
    for (const p of nucleonAnim.particles) {
      const col = p.type === 'p' ? PROTON_COLOR : NEUTRON_COLOR;
      fill(col[0], col[1], col[2]);
      circle(cx + p.x * nucleusR, cy + p.y * nucleusR, dotDiam);
    }

    // Etiqueta bajo el núcleo cuando cabe
    if (nucleusR > 20) {
      const ink = inkText(uiCache.theme);
      noStroke();
      fill(ink[0], ink[1], ink[2]);
      textAlign(CENTER, TOP);
      textSize(Math.min(12, nucleusR * 0.25));
      textStyle(NORMAL);
      text(el.Z + "p · " + el.N + "n", cx, cy + nucleusR + 4);
    }
  }

  pop();
}

// Cota (línea de medida) bajo el dibujo. Muestra el diámetro del núcleo en cuanto
// éste es visible (nucleusR >= 0.5 px); antes, muestra la fracción del átomo a escala.
// Durante la animación: flecha saliente (referencia actual) + flecha entrante (siguiente).
function drawDiameterCota(theme, cx, cy, atomR, el, effectiveCI) {
  const ink = inkText(theme);
  const animating = zoomAnimDir !== 0;
  const y = cy + atomR + 24;
  const ARROW_HEAD = 14;

  const ratio = el.nucleusDiameterM / el.atomDiameterM;

  function nucleusRAtCI(ci) {
    return ratio * atomR / Math.pow(10, ci);
  }

  function drawNucleusRef(nucR) {
    const col = stepColor(0);
    const diam = diamLabel(el.nucleusDiameterM);
    const nom  = "Núcleo de " + el.name;
    if (nucR < 2 * ARROW_HEAD) drawCotaDimension(cx, y, nucR, col, diam, nom, ink);
    else                        drawCotaLine(cx, y, nucR, col, diam, nom, ink, false);
  }

  if (!animating) {
    const nucR = nucleusRAtCI(clickIndex);
    if (nucR >= 0.5) {
      drawNucleusRef(nucR);
    } else {
      const col = zoomArrowColor(clickIndex);
      const physDiam = el.atomDiameterM * Math.pow(10, clickIndex);
      const lbl = clickIndex === 0 ? "Átomo de " + el.name : null;
      drawCotaLine(cx, y, atomR, col, diamLabel(physDiam), lbl, ink, false);
    }
  } else {
    const halfBig   = atomR * Math.pow(10, -(effectiveCI - clickIndex));
    const nextCI    = clickIndex + zoomAnimDir;
    const halfSmall = atomR * Math.pow(10, nextCI - effectiveCI);
    const nucR_anim = ratio * atomR / Math.pow(10, effectiveCI);
    const areaHalf  = (width - 40) / 2;

    const nucRCurrent = nucleusRAtCI(clickIndex);
    const nucRNext    = nucleusRAtCI(nextCI);

    if (nucRCurrent >= 0.5) {
      // Paso actual ya muestra el núcleo: una sola cota del núcleo que crece/mengua.
      if (nucR_anim >= 0.5) drawNucleusRef(nucR_anim);
    } else {
      // Flecha saliente: fracción del átomo en el paso actual.
      if (halfBig <= areaHalf * 1.05 && halfBig > 2) {
        drawCotaLine(cx, y, halfBig, zoomArrowColor(clickIndex), null, null, ink, true);
      }
      // Flecha entrante: núcleo si ya es visible en el siguiente paso, si no fracción del átomo.
      if (nucRNext >= 0.5) {
        drawNucleusRef(nucR_anim);
      } else {
        const physDiam2 = el.atomDiameterM * Math.pow(10, nextCI);
        const name2 = nextCI === 0 ? "Átomo de " + el.name : null;
        drawCotaLine(cx, y, halfSmall, zoomArrowColor(nextCI), diamLabel(physDiam2), name2, ink, false);
      }
    }
  }
}

// Dibuja una flecha de cota centrada en cx, en la fila y, con semiancho halfPx.
// Si noLabel=true omite el texto (para la flecha "grande" durante la animación).
function drawCotaLine(cx, y, halfPx, col, diamLabel, nameLabel, ink, noLabel) {
  const x1 = cx - halfPx, x2 = cx + halfPx;
  push();
  stroke(col[0], col[1], col[2]);
  strokeWeight(2.5);
  line(x1, y, x2, y);
  if (halfPx > 8) {
    line(x1, y - 8, x1, y + 8);
    line(x2, y - 8, x2, y + 8);
  }
  noStroke();
  fill(col[0], col[1], col[2]);
  if (x1 > -50)       triangle(x1, y, x1 + 14, y - 7, x1 + 14, y + 7);
  if (x2 < width + 50) triangle(x2, y, x2 - 14, y - 7, x2 - 14, y + 7);
  pop();

  if (!noLabel && diamLabel) {
    push();
    textAlign(CENTER, BOTTOM);
    textStyle(BOLD);
    textSize(12);
    fill(col[0], col[1], col[2]);
    text(diamLabel, cx, y - 5);
    if (nameLabel) {
      textAlign(CENTER, TOP);
      textSize(13.5);
      fill(ink[0], ink[1], ink[2]);
      text(nameLabel, cx, y + 12);
    }
    textStyle(NORMAL);
    pop();
  }
}

// Cota con triángulos hacia adentro: se usa cuando el núcleo es visible pero
// su diámetro en px < 4 × cabeza de flecha (halfPx < 2·ARROW_HEAD).
// Las puntas de los triángulos quedan en x1/x2; las bases sobresalen al exterior.
function drawCotaDimension(cx, y, halfPx, col, diamLabel, nameLabel, ink) {
  const x1 = cx - halfPx, x2 = cx + halfPx;
  const HEAD = 14, TICK = 10;
  push();
  stroke(col[0], col[1], col[2]);
  strokeWeight(1.5);
  line(x1, y, x2, y);              // línea horizontal
  line(x1, y - TICK, x1, y + TICK); // marca vertical izquierda
  line(x2, y - TICK, x2, y + TICK); // marca vertical derecha
  noStroke();
  fill(col[0], col[1], col[2]);
  // triángulo izquierdo: punta en x1, base al exterior (izquierda)
  triangle(x1, y, x1 - HEAD, y - 7, x1 - HEAD, y + 7);
  // triángulo derecho: punta en x2, base al exterior (derecha)
  triangle(x2, y, x2 + HEAD, y - 7, x2 + HEAD, y + 7);
  pop();

  if (diamLabel) {
    push();
    textAlign(CENTER, BOTTOM);
    textStyle(BOLD);
    textSize(12);
    fill(col[0], col[1], col[2]);
    text(diamLabel, cx, y - 5);
    if (nameLabel) {
      textAlign(CENTER, TOP);
      textSize(13.5);
      fill(ink[0], ink[1], ink[2]);
      text(nameLabel, cx, y + 12);
    }
    textStyle(NORMAL);
    pop();
  }
}

// Recuadro superior izquierdo que advierte de que el núcleo no es visible aquí.
// Flecha roja desde el borde del recuadro hasta el centro del átomo (nucCx, nucCy).
function drawNucleusInfoBox(theme, nucCx, nucCy) {
  const card = cardColors(theme);
  const red  = stepColor(0);
  const msg  = "El núcleo está en el centro, pero es demasiado pequeño para verlo.";
  const boxW = Math.min(252, Math.max(176, width * 0.36));
  const pad  = 12;
  const x    = 14;
  const y    = 20;

  // Altura dinámica: simular word-wrap para contar líneas reales.
  push();
  textSize(11.5);
  textLeading(15);
  const lineW = boxW - pad - 10;
  const words = msg.split(' ');
  let numLines = 1, curW = 0;
  for (const word of words) {
    const ww = textWidth(word + ' ');
    if (curW > 0 && curW + ww > lineW) { numLines++; curW = ww; }
    else { curW += ww; }
  }
  const boxH = numLines * 15 + pad + 16;

  // Punto de anclaje en el borde del recuadro más cercano a (nucCx, nucCy).
  let anchorX, anchorY;
  if (nucCx < x) {
    anchorX = x;
    anchorY = Math.max(y, Math.min(y + boxH, nucCy));
  } else if (nucCx > x + boxW) {
    anchorX = x + boxW;
    anchorY = Math.max(y, Math.min(y + boxH, nucCy));
  } else {
    anchorX = Math.max(x, Math.min(x + boxW, nucCx));
    anchorY = nucCy < y ? y : y + boxH;
  }

  // Dirección hacia el núcleo.
  const dx = nucCx - anchorX, dy = nucCy - anchorY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) { pop(); return; }
  const ux = dx / dist, uy = dy / dist;

  // Cabeza de flecha: triángulo pequeño con punta a 4 px del centro.
  const GAP = 4, DEPTH = 8, HALF = 4;
  const tipX = nucCx - ux * GAP,        tipY  = nucCy - uy * GAP;
  const baseX = tipX - ux * DEPTH,      baseY = tipY  - uy * DEPTH;
  const perpX = -uy * HALF,             perpY = ux * HALF;

  // 1. Flecha (primero, para que el recuadro tape el inicio de la línea).
  stroke(red[0], red[1], red[2]);
  strokeWeight(1.5);
  line(anchorX, anchorY, baseX, baseY);
  noStroke();
  fill(red[0], red[1], red[2]);
  triangle(tipX, tipY, baseX + perpX, baseY + perpY, baseX - perpX, baseY - perpY);

  // 2. Recuadro (encima de la línea en el punto de anclaje).
  rectMode(CORNER);
  stroke(card.border[0], card.border[1], card.border[2]);
  strokeWeight(1);
  fill(card.bg[0], card.bg[1], card.bg[2]);
  rect(x, y, boxW, boxH, 9);

  // Marca roja en el borde izquierdo.
  noStroke();
  fill(red[0], red[1], red[2]);
  rect(x + 1, y + 9, 3, boxH - 18, 2);

  // Texto.
  fill(card.ink[0], card.ink[1], card.ink[2]);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(11.5);
  textLeading(15);
  textWrap(WORD);
  text(msg, x + pad, y + 12, boxW - pad - 10);
  pop();
}

// Recuadro inferior derecho que explica la representación de los electrones.
// Flecha del mismo color que los electrones, apuntando a la capa más externa visible.
function drawElectronInfoBox(theme, cx, cy, atomR, el, effectiveCI) {
  const numShells = el.shells.length;
  const zoomFactor = Math.pow(10, effectiveCI);

  // Capa más externa visible (que quepa en el lienzo).
  let outerRs = -1;
  for (let s = numShells - 1; s >= 0; s--) {
    const rs = atomR * (s + 1) / numShells / zoomFactor;
    if (rs > 0 && rs <= Math.max(width, height)) { outerRs = rs; break; }
  }
  if (outerRs < 0) return;

  const card = cardColors(theme);
  const acc  = accentColor(theme);
  const msg  = "Los electrones son más pequeños que el núcleo, pero los representamos como una bolita para que quede claro que estamos trabajando con átomos.";
  const boxW = Math.min(155, Math.max(120, width * 0.18));
  const pad  = 12;
  const x    = width - boxW - 14;

  // Altura dinámica por word-wrap.
  push();
  textSize(11.5);
  textLeading(15);
  const lineW = boxW - pad - 10;
  const words = msg.split(' ');
  let numLines = 1, curW = 0;
  for (const word of words) {
    const ww = textWidth(word + ' ');
    if (curW > 0 && curW + ww > lineW) { numLines++; curW = ww; }
    else { curW += ww; }
  }
  const boxH = numLines * 15 + pad + 16;
  _electronBoxH = boxH; // sincroniza electronInfoBoxRect() con la altura real
  const y = 20;

  // Punto objetivo: punto en el anillo exterior en dirección hacia el centro de la caja.
  const boxCx = x + boxW / 2, boxCy = y + boxH / 2;
  const dxDir = boxCx - cx, dyDir = boxCy - cy;
  const dirDist = Math.sqrt(dxDir * dxDir + dyDir * dyDir);
  if (dirDist === 0) { pop(); return; }
  const ux = dxDir / dirDist, uy = dyDir / dirDist;
  const targetX = cx + ux * outerRs, targetY = cy + uy * outerRs;

  // Punto de anclaje en el borde del recuadro más cercano al target.
  let anchorX, anchorY;
  if (targetX < x) {
    anchorX = x;
    anchorY = Math.max(y, Math.min(y + boxH, targetY));
  } else if (targetX > x + boxW) {
    anchorX = x + boxW;
    anchorY = Math.max(y, Math.min(y + boxH, targetY));
  } else {
    anchorX = Math.max(x, Math.min(x + boxW, targetX));
    anchorY = targetY < y ? y : y + boxH;
  }

  const dx = targetX - anchorX, dy = targetY - anchorY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) { pop(); return; }
  const arrowUx = dx / dist, arrowUy = dy / dist;

  const GAP = 4, DEPTH = 8, HALF = 4;
  const tipX  = targetX - arrowUx * GAP,       tipY  = targetY - arrowUy * GAP;
  const baseX = tipX - arrowUx * DEPTH,         baseY = tipY - arrowUy * DEPTH;
  const perpX = -arrowUy * HALF,                perpY = arrowUx * HALF;

  // 1. Flecha (color de los electrones).
  stroke(acc[0], acc[1], acc[2]);
  strokeWeight(1.5);
  line(anchorX, anchorY, baseX, baseY);
  noStroke();
  fill(acc[0], acc[1], acc[2]);
  triangle(tipX, tipY, baseX + perpX, baseY + perpY, baseX - perpX, baseY - perpY);

  // 2. Recuadro.
  rectMode(CORNER);
  stroke(card.border[0], card.border[1], card.border[2]);
  strokeWeight(1);
  fill(card.bg[0], card.bg[1], card.bg[2]);
  rect(x, y, boxW, boxH, 9);

  // Marca del color de los electrones en el borde izquierdo.
  noStroke();
  fill(acc[0], acc[1], acc[2]);
  rect(x + 1, y + 9, 3, boxH - 18, 2);

  // Texto.
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

function initNucleonAnim(el) {
  const points = buildNucleonLayout(el);
  nucleonAnim = {
    elementId: el.id,
    particles: points.map(p => ({
      type: p.type,
      x: p.x * 0.85,
      y: p.y * 0.85,
      vx: random(-0.5, 0.5),
      vy: random(-0.5, 0.5),
    }))
  };
}

// Movimiento browniano confinado dentro del radio del núcleo (coordenadas normalizadas).
function updateNucleonAnim(dt) {
  if (!nucleonAnim) return;
  const KICK   = 15.0; // amplitud del impulso aleatorio (radio/s)
  const DAMP   = 0.3;  // tasa de amortiguación continua (1/s)
  const WALL   = 0.84; // radio de la pared blanda (normalizado)
  const WALL_K = 8.0;  // rigidez de la pared blanda

  for (const p of nucleonAnim.particles) {
    p.vx += random(-1, 1) * KICK * dt;
    p.vy += random(-1, 1) * KICK * dt;

    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    if (r > WALL && r > 0) {
      const excess = r - WALL;
      p.vx -= (p.x / r) * WALL_K * excess * dt;
      p.vy -= (p.y / r) * WALL_K * excess * dt;
    }

    const decay = Math.exp(-DAMP * dt);
    p.vx *= decay;
    p.vy *= decay;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const rNew = Math.sqrt(p.x * p.x + p.y * p.y);
    if (rNew > 0.93) {
      p.x *= 0.93 / rNew;
      p.y *= 0.93 / rNew;
      const nx = p.x / 0.93, ny = p.y / 0.93;
      const dot = p.vx * nx + p.vy * ny;
      if (dot > 0) { p.vx -= dot * nx; p.vy -= dot * ny; }
    }
  }
}

// Recuadro informativo que aparece en el canvas cuando el usuario llega al núcleo.
// Ocupa la esquina superior izquierda, igual que drawNucleusInfoBox, pero en lugar
// de advertir de que el núcleo no se ve, confirma el logro y da el factor de escala.
function drawNucleusReachedBox(theme, el) {
  const card = cardColors(theme);
  const green = theme === "high-contrast" ? [0, 255, 136] : [16, 185, 129];
  const ratio = Math.round(el.atomDiameterM / el.nucleusDiameterM).toLocaleString('es-ES');
  const msg = "Estás viendo el núcleo. El átomo completo es " + ratio + " veces más grande.";
  const boxW = Math.min(240, Math.max(180, width * 0.28));
  const pad = 12;
  const x = 14, y = 20;
  push();
  textSize(11.5);
  textLeading(16);
  const lineW = boxW - pad - 10;
  const words = msg.split(' ');
  let numLines = 1, curW = 0;
  for (const word of words) {
    const ww = textWidth(word + ' ');
    if (curW > 0 && curW + ww > lineW) { numLines++; curW = ww; }
    else { curW += ww; }
  }
  const boxH = numLines * 16 + pad + 16;
  rectMode(CORNER);
  stroke(card.border[0], card.border[1], card.border[2]);
  strokeWeight(1);
  fill(card.bg[0], card.bg[1], card.bg[2]);
  rect(x, y, boxW, boxH, 9);
  noStroke();
  fill(green[0], green[1], green[2]);
  rect(x + 1, y + 9, 3, boxH - 18, 2);
  fill(card.ink[0], card.ink[1], card.ink[2]);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(11.5);
  textLeading(16);
  textWrap(WORD);
  text(msg, x + pad, y + 12, boxW - pad - 10);
  pop();
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

// =========================================================
// Panel lateral: datos del elemento, progreso, franja de líneas (DOM)
// =========================================================

function populateElementSelect() {
  const select = document.getElementById("ui-element-select");
  select.innerHTML = ELEMENTS.map((el) => '<option value="' + el.id + '">' + el.name + " (Z=" + el.Z + ")</option>").join("");
  select.value = currentElementId;
}

function renderElementFacts() {
  const el = getElement();
  const box = document.getElementById("element-facts");
  const ratio = Math.round(el.atomDiameterM / el.nucleusDiameterM).toLocaleString('es-ES');
  const rows = [
    ["Protones (Z)", el.Z],
    ["Neutrones (N)", el.N],
    ["Diámetro del núcleo", formatLength(el.nucleusDiameterM)],
    ["Diámetro del átomo", formatLength(el.atomDiameterM)],
    ["Tasa átomo / núcleo", ratio + " : 1"],
    ["Capas electrónicas", el.shells.length + " (" + el.shells.map((c, i) => SHELL_NAMES[i] + ":" + c).join(", ") + ")"],
  ];
  box.innerHTML = rows.map((r) => '<div class="fact-row"><span>' + r[0] + '</span><span class="fact-value">' + r[1] + "</span></div>").join("");
}

function renderJourneyProgress() {
  const el = getElement();
  const total = maxClickIndex(el);
  const fill = document.getElementById("ui-progress-fill");
  const text = document.getElementById("ui-progress-text");
  const steps = document.getElementById("ui-progress-steps");

  const pct = total === 0 ? 0 : Math.max(0, Math.round((-clickIndex / total) * 100));
  if (fill) {
    fill.style.width = pct + "%";
    fill.classList.toggle("is-complete", total > 0 && clickIndex === -total);
  }
  const track = document.getElementById("ui-progress-track");
  if (track) track.setAttribute("aria-valuenow", pct);

  const atNucleus = total > 0 && clickIndex === -total;
  const label = atNucleus ? "¡Núcleo alcanzado! ×" + Math.pow(10, total).toLocaleString('es-ES')
    : clickIndex === 0 ? "Escala natural"
    : clickIndex > 0 ? "Alejado ×" + Math.pow(10, clickIndex).toLocaleString('es-ES')
    : "Tamaño original ×" + Math.pow(10, -clickIndex).toLocaleString('es-ES');
  if (text) text.innerText = label;
  if (steps) steps.textContent = clickIndex !== 0 ? Math.abs(clickIndex) + " / " + total : "";

  const animating = zoomAnimDir !== 0;
  const btnOut = document.getElementById("ui-btn-zoom-out");
  if (btnOut) btnOut.disabled = animating || clickIndex >= total;
  const btnIn = document.getElementById("ui-btn-zoom-in");
  if (btnIn) btnIn.disabled = animating || clickIndex <= -total;
}

function makeNuclearRulerRow(col, name, pxNucleus, pxAtom, label) {
  const tickInterval = 100 * pxNucleus;
  const numTicks = tickInterval >= 6 ? Math.min(Math.floor(pxAtom / tickInterval), 2000) : 0;

  let innerHtml = '<div class="ladder-nucleus-bar" style="width:' + Math.max(pxNucleus, 0.5) + 'px; background:' + rgbStr(col) + ';"></div>';
  for (let k = 1; k <= numTicks; k++) {
    innerHtml +=
      '<div class="ladder-nucleus-tick" style="left:' + (k * tickInterval) + 'px;">' +
        '<span class="ladder-nucleus-tick-lbl">' + (k * 100) + '·D</span>' +
        '<div class="ladder-nucleus-tick-line"></div>' +
      '</div>';
  }

  return '<div class="ladder-row">' +
    '<span class="ladder-row-label">' +
      '<span class="ladder-row-swatch" style="background:' + rgbStr(col) + '"></span>' +
      name +
    '</span>' +
    '<div class="ladder-nucleus-track" style="width:' + pxAtom + 'px;">' +
      innerHtml +
    '</div>' +
    '<span class="ladder-row-px">' + Math.round(pxNucleus) + ' px</span>' +
    '<span class="ladder-row-value">' + label + '</span>' +
    '</div>';
}

function makeLadderRow(col, name, px, label) {
  return '<div class="ladder-row">' +
    '<span class="ladder-row-label">' +
      '<span class="ladder-row-swatch" style="background:' + rgbStr(col) + '"></span>' +
      name +
    '</span>' +
    '<span class="ladder-row-bar" style="width:' + px + 'px; background:' + rgbStr(col) + '; margin-right:6px;"></span>' +
    '<span class="ladder-row-px">' + Math.round(px) + ' px</span>' +
    '<span class="ladder-row-value">' + label + '</span>' +
    '</div>';
}

function renderLadder() {
  const el = getElement();
  const section = document.getElementById("ladder-section");
  const { atomR } = atomLayout();
  const n = maxClickIndex(el);

  // El núcleo aparece cuando su tamaño en pantalla supera 0.5 px.
  let nucleusStep = n;
  for (let k = 1; k <= n; k++) {
    if ((el.nucleusDiameterM / el.atomDiameterM) * atomR * Math.pow(10, k) >= 0.5) {
      nucleusStep = k;
      break;
    }
  }

  // j=0 (átomo) siempre visible; cada zoom-in añade una barra más hasta nucleusStep.
  const stepsIn = Math.max(0, -clickIndex);
  const numBars = Math.min(stepsIn, nucleusStep) + 1;

  const showIntermediate = document.getElementById("ui-show-intermediate")?.checked ?? true;

  const rows = [];
  for (let j = 0; j < numBars; j++) {
    const isNucleus = (j === nucleusStep);
    if (!showIntermediate && j > 0 && !isNucleus) continue;
    let physDiam, col, name;
    if (isNucleus) {
      physDiam = el.nucleusDiameterM;
      col = stepColor(0); // rojo — mismo que la cota del núcleo en el canvas
      name = "Núcleo de " + el.name;
    } else {
      // physDiam coincide con lo que representa la flecha del canvas cuando clickIndex = -j
      physDiam = el.atomDiameterM * Math.pow(10, -j);
      col = zoomArrowColor(-j); // idéntico al color de la flecha en ese paso de zoom
      name = j === 0 ? "Átomo de " + el.name : "1/" + Math.pow(10, j).toLocaleString('es-ES') + " del átomo";
    }
    // px coincide con 2·atomR cuando clickIndex = -j (el momento en que nace la barra)
    const px = (physDiam / el.atomDiameterM) * 2 * atomR * Math.pow(10, -clickIndex);
    const label = formatLength(physDiam) + " / " + formatScientificM(physDiam);
    if (isNucleus) {
      const pxAtom = 2 * atomR * Math.pow(10, -clickIndex);
      rows.push(makeNuclearRulerRow(col, name, px, pxAtom, label));
    } else {
      rows.push(makeLadderRow(col, name, Math.max(px, 0.5), label));
    }
  }

  section.innerHTML = rows.join('');
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
  zoomAnimT = 0;
  zoomAnimDir = 0;
  ladderScalePx = BASE_PX;
  refreshAll();
}

function setupUIEventListeners() {
  document.getElementById("ui-element-select").addEventListener("change", (e) => {
    currentElementId = e.target.value;
    electronAngles = [];
    nucleonAnim = null;
    resetJourney();
  });

  document.getElementById("ui-btn-zoom-out").addEventListener("click", () => {
    if (zoomAnimDir !== 0) return;
    const el = getElement();
    if (clickIndex < maxClickIndex(el)) {
      zoomAnimDir = +1;
      zoomAnimT = 0;
      renderJourneyProgress(); // deshabilitar botones de inmediato
    }
  });

  document.getElementById("ui-btn-zoom-in").addEventListener("click", () => {
    if (zoomAnimDir !== 0) return;
    const el = getElement();
    if (clickIndex > -maxClickIndex(el)) {
      zoomAnimDir = -1;
      zoomAnimT = 0;
      renderJourneyProgress();
    }
  });

  document.getElementById("ui-btn-reset").addEventListener("click", () => {
    resetJourney();
  });

  const showIntermediateCheck = document.getElementById("ui-show-intermediate");
  if (showIntermediateCheck) {
    showIntermediateCheck.addEventListener("change", renderLadder);
  }

  const showPxCheck = document.getElementById("ui-show-px");
  if (showPxCheck) {
    showPxCheck.addEventListener("change", () => {
      document.getElementById("ladder-section").classList.toggle("show-px", showPxCheck.checked);
    });
  }

  const infoCard = document.getElementById("ui-panel-info");
  document.getElementById("ui-info-trigger").addEventListener("click", () => {
    infoCard.classList.toggle("is-expanded");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") {
      document.getElementById("ui-btn-zoom-in").click();
    } else if (e.key === "ArrowLeft") {
      document.getElementById("ui-btn-zoom-out").click();
    } else if (e.key === "r" || e.key === "R") {
      document.getElementById("ui-btn-reset").click();
    }
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
