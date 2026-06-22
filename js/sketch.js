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
  { id: "H",  name: "Hidrógeno", Z: 1,  A: 1,   shells: [1],             atomicRadiusPm: 53  },
  { id: "He", name: "Helio",     Z: 2,  A: 4,   shells: [2],             atomicRadiusPm: 31  },
  { id: "C",  name: "Carbono",   Z: 6,  A: 12,  shells: [2, 4],          atomicRadiusPm: 70  },
  { id: "O",  name: "Oxígeno",   Z: 8,  A: 16,  shells: [2, 6],          atomicRadiusPm: 60  },
  { id: "Na", name: "Sodio",     Z: 11, A: 23,  shells: [2, 8, 1],       atomicRadiusPm: 190 },
  { id: "Cl", name: "Cloro",     Z: 17, A: 35,  shells: [2, 8, 7],       atomicRadiusPm: 100 },
  { id: "Fe", name: "Hierro",    Z: 26, A: 56,  shells: [2, 8, 14, 2],   atomicRadiusPm: 126 },
  { id: "Au", name: "Oro",       Z: 79, A: 197, shells: [2, 8, 18, 32, 18, 1], atomicRadiusPm: 144 },
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

// blobR (radio del átomo en px) por debajo del cual aparecen los átomos adyacentes.
// Para todos los elementos con ≤ 3 capas el umbral blob y adyacente coinciden
// en el tiempo; Fe y Au tienen una breve fase blob sin adyacente.
const ADJACENT_ATOMS_THRESHOLD_PX = 20;

// blobR < este valor (diámetro < 2 px) → representación como continuo.
const CONTINUUM_THRESHOLD_PX = 1;

// Objeto macroscópico representativo de cada material y su tamaño típico.
const MACRO_OBJECTS = {
  "H":  { label: "cubito de hielo", sizeM: 0.025 },
  "O":  { label: "cubito de hielo", sizeM: 0.025 },
  "Na": { label: "grano de sal",    sizeM: 5e-4  },
  "Cl": { label: "grano de sal",    sizeM: 5e-4  },
  "Fe": { label: "clavo",           sizeM: 0.05  },
  "Au": { label: "anillo de oro",   sizeM: 0.02  },
};

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
let nucleonAnim = null; // { elementId, particles: [{x,y,vx,vy,type}] } coords normalizadas (1 = nucleusR)
let electronAngles = [];

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

// Pasos de zoom-out (×10) necesarios para que el lienzo represente la escala del
// objeto macroscópico del material. Asume atomR≈200 px, canvas width≈800 px.
function macroZoomOutIndex(el) {
  const info = MACRO_OBJECTS[el.id];
  if (!info) return Infinity;
  // Primer paso entero donde el canvas (≈ atomDiameterM × 10^k metros) contiene el objeto.
  return Math.ceil(Math.log10(info.sizeM / el.atomDiameterM));
}

function maxZoomOutIndex(el) {
  const mci = macroZoomOutIndex(el);
  return isFinite(mci) ? mci : maxClickIndex(el);
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
  textFont('system-ui, -apple-system, "Segoe UI", sans-serif');
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
  const blobRd = atomR / Math.pow(10, effectiveCI);
  const minOrbitSpacingPx = atomR / el.shells.length / Math.pow(10, effectiveCI);
  const inBlob      = minOrbitSpacingPx <= 6;
  const inContinuum = inBlob && blobRd < CONTINUUM_THRESHOLD_PX;
  const _macroInfo  = MACRO_OBJECTS[el.id];
  const _canvasPhysW = width * el.atomDiameterM * Math.pow(10, effectiveCI) / (2 * atomR);
  const inMacro     = inContinuum && !!_macroInfo && _macroInfo.sizeM <= _canvasPhysW;

  if (inMacro) {
    drawMacroInfoBox(theme, el);
  } else if (inContinuum) {
    drawContinuumInfoBox(theme);
  } else if (inBlob) {
    drawPartsIndistinguishableBox(theme, cx, cy);
  } else {
    if ((el.nucleusDiameterM / el.atomDiameterM) * atomR / Math.pow(10, effectiveCI) < 0.5) {
      drawNucleusInfoBox(theme, cx, cy);
    }
    drawElectronInfoBox(theme, cx, cy, atomR, el, effectiveCI);
    if (zoomAnimDir === 0 && clickIndex === -maxClickIndex(el)) {
      drawNucleusReachedBox(theme, el);
    }
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
  const blobR = atomR / zoomFactor;
  const minOrbitSpacingPx = atomR / numShells / zoomFactor;
  const isBlob       = minOrbitSpacingPx <= 6;
  const showAdjacent = isBlob && blobR <= ADJACENT_ATOMS_THRESHOLD_PX;
  const isContinuum  = isBlob && blobR < CONTINUUM_THRESHOLD_PX;
  const macroInfo    = MACRO_OBJECTS[el.id];
  const canvasPhysW  = width * el.atomDiameterM * zoomFactor / (2 * atomR);
  const isMacro      = isContinuum && !!macroInfo && macroInfo.sizeM <= canvasPhysW;

  while (electronAngles.length < numShells) electronAngles.push(random(TWO_PI));

  const tickAngles = () => {
    for (let s = 0; s < numShells; s++)
      electronAngles[s] += (0.32 / Math.sqrt(s + 1)) * (deltaTime / 1000);
  };

  if (isMacro) {
    tickAngles();
    const objPx = macroInfo.sizeM * width / canvasPhysW;
    drawMacroObject(el, objPx);
    drawMacroComparisonCota(theme, cx, cy, atomR, el);
  } else if (isContinuum) {
    tickAngles();
    drawContinuum(el);
    drawDiameterCota(theme, cx, cy, atomR, el, effectiveCI);
  } else if (showAdjacent) {
    tickAngles();
    drawAdjacentStructure(el, cx, cy, blobR);
    drawDiameterCota(theme, cx, cy, atomR, el, effectiveCI);
  } else if (isBlob) {
    tickAngles();
    drawAtomBlob(theme, cx, cy, blobR);
    drawDiameterCota(theme, cx, cy, atomR, el, effectiveCI);
  } else {
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
}

// Átomo representado como esfera sólida cuando las partes ya no son distinguibles.
function drawAtomBlob(theme, cx, cy, blobR) {
  if (blobR < 0.5) return;
  const acc = accentColor(theme);
  push();
  // Relleno sólido
  noStroke();
  fill(acc[0], acc[1], acc[2], 85);
  circle(cx, cy, blobR * 2);
  // Contorno
  stroke(acc[0], acc[1], acc[2]);
  strokeWeight(Math.min(2, Math.max(1, blobR * 0.04)));
  noFill();
  circle(cx, cy, blobR * 2);
  // Brillo superior para efecto esfera
  noStroke();
  fill(255, 255, 255, 35);
  const hr = blobR * 0.45;
  circle(cx - blobR * 0.22, cy - blobR * 0.22, hr * 2);
  pop();
}

// Recuadro único que reemplaza a los dos recuadros habituales cuando las partes
// del átomo ya no son distinguibles. Flecha azul apuntando al centro del átomo.
function drawPartsIndistinguishableBox(theme, cx, cy) {
  const card = cardColors(theme);
  const acc = accentColor(theme);
  const msg = "El tamaño al que se representa el átomo es tan pequeño que ya no se pueden distinguir sus partes. Se representa como una esfera sólida.";
  const boxW = Math.min(252, Math.max(176, width * 0.36));
  const pad = 12;
  const x = 14, y = 20;

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

  // Punto de anclaje en el borde del recuadro más cercano a (cx, cy)
  let anchorX, anchorY;
  if (cx < x) {
    anchorX = x;
    anchorY = Math.max(y, Math.min(y + boxH, cy));
  } else if (cx > x + boxW) {
    anchorX = x + boxW;
    anchorY = Math.max(y, Math.min(y + boxH, cy));
  } else {
    anchorX = Math.max(x, Math.min(x + boxW, cx));
    anchorY = cy < y ? y : y + boxH;
  }

  const dx = cx - anchorX, dy = cy - anchorY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) { pop(); return; }
  const ux = dx / dist, uy = dy / dist;

  const GAP = 4, DEPTH = 8, HALF = 4;
  const tipX  = cx - ux * GAP,        tipY  = cy - uy * GAP;
  const baseX = tipX - ux * DEPTH,    baseY = tipY - uy * DEPTH;
  const perpX = -uy * HALF,           perpY =  ux * HALF;

  // Flecha (acento azul, igual que los electrones)
  stroke(acc[0], acc[1], acc[2]);
  strokeWeight(1.5);
  line(anchorX, anchorY, baseX, baseY);
  noStroke();
  fill(acc[0], acc[1], acc[2]);
  triangle(tipX, tipY, baseX + perpX, baseY + perpY, baseX - perpX, baseY - perpY);

  // Recuadro
  rectMode(CORNER);
  stroke(card.border[0], card.border[1], card.border[2]);
  strokeWeight(1);
  fill(card.bg[0], card.bg[1], card.bg[2]);
  rect(x, y, boxW, boxH, 9);

  // Franja de color en el borde izquierdo
  noStroke();
  fill(acc[0], acc[1], acc[2]);
  rect(x + 1, y + 9, 3, boxH - 18, 2);

  // Texto
  fill(card.ink[0], card.ink[1], card.ink[2]);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(11.5);
  textLeading(15);
  textWrap(WORD);
  text(msg, x + pad, y + 12, boxW - pad - 10);
  pop();
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
  const msg  = "Representamos los electrones como puntos para que puedas ver en qué capa están, no para indicar su tamaño real.";
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
  const macroInfo = MACRO_OBJECTS[el.id];
  const atMacro   = macroInfo && clickIndex >= macroZoomOutIndex(el);
  const label = atNucleus ? "¡Núcleo alcanzado! ×" + Math.pow(10, total).toLocaleString('es-ES')
    : atMacro   ? "Escala macroscópica: " + macroInfo.label
    : clickIndex === 0 ? "Escala natural"
    : clickIndex > 0 ? "Alejado ×" + Math.pow(10, clickIndex).toLocaleString('es-ES')
    : "Tamaño original ×" + Math.pow(10, -clickIndex).toLocaleString('es-ES');
  if (text) text.innerText = label;
  if (steps) steps.textContent = clickIndex !== 0 ? Math.abs(clickIndex) + " / " + total : "";

  const animating = zoomAnimDir !== 0;
  const btnOut = document.getElementById("ui-btn-zoom-out");
  if (btnOut) btnOut.disabled = animating || clickIndex >= maxZoomOutIndex(el);
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
  const ladderEl = document.getElementById("ladder-section");
  if (ladderEl) ladderEl.scrollLeft = 0;
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
    if (clickIndex < maxZoomOutIndex(el)) {
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
  const infoTrigger = document.getElementById("ui-info-trigger");
  infoTrigger.addEventListener("click", () => {
    infoCard.classList.toggle("is-expanded");
    infoTrigger.setAttribute("aria-expanded", String(infoCard.classList.contains("is-expanded")));
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

// =====================================================================
// Estructuras moleculares y cristalinas (zoom-out, átomos adyacentes)
// =====================================================================

function drawAdjacentStructure(el, cx, cy, blobR) {
  switch (el.id) {
    case "H": case "O":   drawWaterMolecules(cx, cy, blobR);        break;
    case "C":             drawGraphiteLattice(cx, cy, blobR);       break;
    case "Fe":            drawMetalLattice(cx, cy, blobR, false);   break;
    case "Au":            drawMetalLattice(cx, cy, blobR, true);    break;
    case "Na": case "Cl": drawNaClLattice(cx, cy, blobR);           break;
    case "He":            drawHeliumAtoms(cx, cy, blobR);           break;
  }
}

// ── H₂O: moléculas de agua dispuestas en filas alternadas ──────────────
function drawWaterMolecules(cx, cy, blobR) {
  const oR   = Math.max(blobR, 2);
  const hR   = oR * 0.55;
  const bLen = oR * 1.7;                       // distancia O–H (centro a centro)
  const ang  = 52.25 * Math.PI / 180;          // semiángulo del enlace HOH
  const hx   = bLen * Math.sin(ang);           // desplazamiento X del H
  const hy   = bLen * Math.cos(ang);           // desplazamiento Y del H (arriba)

  const spX = oR * 5.5;
  const spY = oR * 5.0;
  const iMin = -Math.ceil((cx + spX) / spX) - 1;
  const iMax =  Math.ceil((width - cx + spX) / spX) + 1;
  const jMin = -Math.ceil((cy + spY) / spY) - 1;
  const jMax =  Math.ceil((height - cy + spY) / spY) + 1;

  push();
  noStroke();
  for (let j = jMin; j <= jMax; j++) {
    const offX = (j & 1) ? spX * 0.5 : 0;
    for (let i = iMin; i <= iMax; i++) {
      const ox = cx + i * spX + offX;
      const oy = cy + j * spY;
      // enlace O–H (línea fina)
      stroke(160, 160, 180, 140);
      strokeWeight(Math.max(0.6, oR * 0.18));
      noFill();
      line(ox, oy, ox - hx, oy - hy);
      line(ox, oy, ox + hx, oy - hy);
      // O rojo
      noStroke();
      fill(215, 55, 55);
      circle(ox, oy, oR * 2);
      // H blancos/azulados
      fill(195, 220, 240);
      circle(ox - hx, oy - hy, hR * 2);
      circle(ox + hx, oy - hy, hR * 2);
    }
  }
  pop();
}

// ── Grafito: red hexagonal de grafeno ──────────────────────────────────
function drawGraphiteLattice(cx, cy, blobR) {
  const d  = Math.max(blobR * 2.5, 3);         // longitud de enlace C–C en px
  const s3 = Math.sqrt(3);
  // Vectores primitivos de la red hexagonal
  const a1x = s3 * d, a1y = 0;
  const a2x = s3 * d / 2, a2y = 1.5 * d;
  // Átomo B dentro de la celda unidad (respecto a A)
  const bx = s3 * d / 2, by = d / 2;
  // Los 3 enlaces desde cada A: hacia B(m,n), B(m-1,n), B(m,n-1)
  const bonds = [[bx, by], [-bx, by], [0, -d]];

  const margin = d * 3;
  const mMax = Math.ceil((width  / 2 + margin) / a1x) + 2;
  const nMax = Math.ceil((height / 2 + margin) / a2y) + 2;

  push();
  stroke(45, 55, 65, 210);
  strokeWeight(Math.max(0.7, blobR * 0.35));
  for (let m = -mMax; m <= mMax; m++) {
    for (let n = -nMax; n <= nMax; n++) {
      const ax = cx + m * a1x + n * a2x;
      const ay = cy + m * a1y + n * a2y;
      for (const [ox, oy] of bonds) line(ax, ay, ax + ox, ay + oy);
    }
  }
  noStroke();
  fill(70, 80, 95);
  for (let m = -mMax; m <= mMax; m++) {
    for (let n = -nMax; n <= nMax; n++) {
      const ax = cx + m * a1x + n * a2x;
      const ay = cy + m * a1y + n * a2y;
      if (ax > -margin && ax < width + margin && ay > -margin && ay < height + margin)
        circle(ax, ay, blobR * 2);
      const bbx = ax + bx, bby = ay + by;
      if (bbx > -margin && bbx < width + margin && bby > -margin && bby < height + margin)
        circle(bbx, bby, blobR * 2);
    }
  }
  pop();
}

// ── Metales: FCC (Au, hexagonal compacto 2D) o BCC (Fe, cuadrado + centro) ──
function drawMetalLattice(cx, cy, blobR, isFCC) {
  push();
  noStroke();
  if (isFCC) {
    // Au: apilamiento hexagonal compacto (proyección de FCC)
    fill(225, 175, 45);
    const a  = Math.max(blobR * 2.25, 3);
    const rH = a * Math.sqrt(3) / 2;
    const iMin = -Math.ceil((cx + a)  / a)  - 1;
    const iMax =  Math.ceil((width  - cx + a)  / a)  + 1;
    const jMin = -Math.ceil((cy + rH) / rH) - 1;
    const jMax =  Math.ceil((height - cy + rH) / rH) + 1;
    for (let j = jMin; j <= jMax; j++) {
      const offX = (j & 1) ? a * 0.5 : 0;
      for (let i = iMin; i <= iMax; i++) {
        circle(cx + i * a + offX, cy + j * rH, blobR * 2);
      }
    }
  } else {
    // Fe: red cúbica centrada en el cuerpo (BCC), proyección cuadrada + centro
    fill(175, 95, 50);
    const a    = Math.max(blobR * 3.0, 4);
    const iMin = -Math.ceil((cx + a) / a) - 1;
    const iMax =  Math.ceil((width  - cx + a) / a) + 1;
    const jMin = -Math.ceil((cy + a) / a) - 1;
    const jMax =  Math.ceil((height - cy + a) / a) + 1;
    for (let j = jMin; j <= jMax; j++) {
      for (let i = iMin; i <= iMax; i++) {
        circle(cx + i * a,           cy + j * a,           blobR * 2);
        circle(cx + i * a + a * 0.5, cy + j * a + a * 0.5, blobR * 2);
      }
    }
  }
  pop();
}

// ── NaCl: red cúbica alternando Na⁺ y Cl⁻ ─────────────────────────────
function drawNaClLattice(cx, cy, blobR) {
  // Radios iónicos reales: Na⁺ 1,02 Å · Cl⁻ 1,81 Å → ratio 0,56
  const naR = Math.max(blobR * 0.95, 2);
  const clR = Math.max(blobR * 1.70, 3);
  const a   = Math.max((naR + clR) * 1.1, 5);  // distancia Na–Cl
  const iMin = -Math.ceil((cx + a) / a) - 1;
  const iMax =  Math.ceil((width  - cx + a) / a) + 1;
  const jMin = -Math.ceil((cy + a) / a) - 1;
  const jMax =  Math.ceil((height - cy + a) / a) + 1;

  push();
  noStroke();
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const x = cx + i * a, y = cy + j * a;
      if (((i + j) & 1) === 0) {
        fill(235, 190, 55);   // Na⁺ amarillo dorado, más pequeño
        circle(x, y, naR * 2);
      } else {
        fill(65, 190, 85);    // Cl⁻ verde, más grande
        circle(x, y, clR * 2);
      }
    }
  }
  pop();
}

// ── He: átomos individuales con posición cuasi-aleatoria estable ───────
function drawHeliumAtoms(cx, cy, blobR) {
  const sp = Math.max(blobR * 7, 12);           // gas noble → separación grande
  function stableNoise(i, j) {
    // Hash determinista para dar posición fija sin noise() de p5
    let h = (i * 374761393 + j * 668265263) | 0;
    h ^= h >>> 13; h = (h * 1540483477) | 0; h ^= h >>> 15;
    return ((h >>> 0) & 0x7FFFFFFF) / 0x7FFFFFFF;
  }
  const iMin = -Math.ceil((cx + sp) / sp) - 1;
  const iMax =  Math.ceil((width  - cx + sp) / sp) + 1;
  const jMin = -Math.ceil((cy + sp) / sp) - 1;
  const jMax =  Math.ceil((height - cy + sp) / sp) + 1;

  push();
  noStroke();
  fill(175, 195, 235);
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const rx = (stableNoise(i * 7 + 3,  j * 5 + 1) - 0.5) * sp * 0.62;
      const ry = (stableNoise(i * 5 + 11, j * 7 + 4) - 0.5) * sp * 0.62;
      const x = cx + i * sp + rx;
      const y = cy + j * sp + ry;
      if (x > -blobR * 2 && x < width + blobR * 2 && y > -blobR * 2 && y < height + blobR * 2)
        circle(x, y, blobR * 2);
    }
  }
  pop();
}

// =====================================================================
// Vista de continuo: átomo < 1 px de radio
// =====================================================================

// Color de fondo del continuo según el material.
function continuumBgColor(el) {
  switch (el.id) {
    case "H": case "O":   return [30,  75, 160];   // agua — azul
    case "C":             return [28,  32,  38];    // grafito — gris muy oscuro
    case "Fe":            return [70,  58,  48];    // hierro — gris parduzco
    case "Au":            return [155, 110,  20];   // oro — dorado oscuro
    case "Na": case "Cl": return [200, 195, 185];   // sal — blanco hueso
    case "He":            return [20,  25,  55];    // helio — negro azulado (gas)
    default:              return [45,  55,  70];
  }
}

// Rellena el lienzo con el color del material continuo.
function drawContinuum(el) {
  const col = continuumBgColor(el);
  push();
  noStroke();
  fill(col[0], col[1], col[2]);
  rect(0, 0, width, height);
  pop();
}

// Recuadro informativo que aparece cuando se alcanza el régimen de continuo.
// No lleva flecha porque el material llena todo el lienzo.
function drawContinuumInfoBox(theme) {
  const card = cardColors(theme);
  const col  = [96, 165, 250];   // azul neutro — mismo tono en todos los temas
  const msg  = "A esta escala los átomos son tan pequeños que no podemos distinguirlos de manera separada. La materia parece un continuo.";
  const boxW = Math.min(280, Math.max(200, width * 0.38));
  const pad  = 14;
  const x = Math.round(width / 2 - boxW / 2);
  const y = 20;

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

  rectMode(CORNER);
  stroke(col[0], col[1], col[2], 180);
  strokeWeight(1.2);
  fill(card.bg[0], card.bg[1], card.bg[2], 230);
  rect(x, y, boxW, boxH, 9);

  noStroke();
  fill(col[0], col[1], col[2]);
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
// Objetos macroscópicos (zoom-out extremo)
// =====================================================================

// Cubo isométrico reutilizado para hielo y sal — solo varía el color.
function drawIsoCube(cx, cy, sz, faceF, faceT, faceR, edgeCol) {
  const ox = sz * 0.55, oy = sz * 0.32;
  const sw = Math.max(0.8, sz * 0.022);
  push();
  strokeJoin(ROUND);
  strokeWeight(sw);
  // Cara derecha
  fill(...faceR);  stroke(...edgeCol);
  beginShape();
  vertex(cx + sz,      cy - sz     );
  vertex(cx + sz + ox, cy - sz - oy);
  vertex(cx + sz + ox, cy + sz - oy);
  vertex(cx + sz,      cy + sz     );
  endShape(CLOSE);
  // Cara superior
  fill(...faceT);  stroke(...edgeCol);
  beginShape();
  vertex(cx - sz,      cy - sz     );
  vertex(cx + sz,      cy - sz     );
  vertex(cx + sz + ox, cy - sz - oy);
  vertex(cx - sz + ox, cy - sz - oy);
  endShape(CLOSE);
  // Cara frontal
  fill(...faceF);  stroke(...edgeCol);
  beginShape();
  vertex(cx - sz, cy - sz);
  vertex(cx + sz, cy - sz);
  vertex(cx + sz, cy + sz);
  vertex(cx - sz, cy + sz);
  endShape(CLOSE);
  // Brillo
  noStroke();
  fill(255, 255, 255, 65);
  ellipse(cx - sz * 0.22, cy - sz * 0.24, sz * 0.52, sz * 0.3);
  pop();
}

function drawIceCube(cx, cy, sz) {
  drawIsoCube(cx, cy, sz,
    [170, 215, 242, 210],
    [210, 238, 255, 210],
    [128, 182, 220, 210],
    [95, 150, 195]
  );
}

function drawGrainOfSalt(cx, cy, sz) {
  drawIsoCube(cx, cy, sz,
    [238, 234, 226, 230],
    [252, 250, 246, 230],
    [215, 210, 200, 230],
    [160, 155, 145]
  );
  push();
  noStroke();
  fill(255, 255, 255, 210);
  const ss = sz * 0.09;
  ellipse(cx - sz * 0.28, cy - sz * 0.3, ss * 2, ss * 2);
  pop();
}

function drawNail(cx, cy, sz) {
  const headW  = sz * 0.72;
  const headH  = sz * 0.095;
  const shaftW = sz * 0.13;
  const headY  = cy - sz * 0.62;
  const tipY   = cy + sz * 1.45;
  const shaftTop = headY + headH * 2;
  const sw = Math.max(0.7, sz * 0.018);

  push();
  strokeJoin(ROUND);
  strokeWeight(sw);

  stroke(68, 72, 80);
  fill(148, 152, 162);
  beginShape();
  vertex(cx - shaftW, shaftTop);
  vertex(cx + shaftW, shaftTop);
  vertex(cx,          tipY);
  endShape(CLOSE);

  noStroke();
  fill(200, 205, 215, 150);
  beginShape();
  vertex(cx - shaftW * 0.22, shaftTop);
  vertex(cx + shaftW * 0.22, shaftTop);
  vertex(cx + shaftW * 0.06, tipY * 0.72 + shaftTop * 0.28);
  endShape(CLOSE);

  stroke(68, 72, 80);
  strokeWeight(sw);
  fill(158, 163, 173);
  ellipse(cx, headY + headH * 1.1, headW * 2, headH * 2);
  noStroke();
  fill(200, 205, 215);
  ellipse(cx, headY + headH * 0.4, headW * 1.85, headH * 1.15);

  pop();
}

function drawRing(cx, cy, sz) {
  const outerR    = sz * 0.84;
  const thickness = sz * 0.21;

  push();
  noFill();
  stroke(55, 35, 0, 55);
  strokeWeight(thickness * 1.05);
  ellipse(cx + sz * 0.04, cy + sz * 0.07, outerR * 2, outerR * 1.42);

  stroke(195, 148, 20);
  strokeWeight(thickness);
  ellipse(cx, cy, outerR * 2, outerR * 1.42);

  stroke(248, 205, 72);
  strokeWeight(thickness * 0.32);
  arc(cx, cy, outerR * 2, outerR * 1.42, PI * 1.18, PI * 1.78);

  stroke(255, 242, 160);
  strokeWeight(thickness * 0.11);
  arc(cx, cy, (outerR - thickness * 0.28) * 2, (outerR - thickness * 0.28) * 1.42,
      PI * 1.22, PI * 1.58);

  pop();
}

function drawMacroObject(el, objPx) {
  const cx = width / 2;
  const cy = height * 0.45;

  switch (el.id) {
    // sz = mitad del lado frontal del cubo; el lado frontal = objPx
    case "H": case "O":   drawIceCube(cx, cy, objPx / 2);      break;
    case "Na": case "Cl": drawGrainOfSalt(cx, cy, objPx / 2);  break;
    // El clavo tiene altura total ≈ sz×2.07; objPx = longitud del clavo
    case "Fe":            drawNail(cx, cy, objPx / 2.07);       break;
    // El anillo tiene diámetro exterior ≈ sz×1.68; objPx = diámetro del anillo
    case "Au":            drawRing(cx, cy, objPx / 1.68);       break;
  }
}

// Zona inferior de comparación en modo macro: dos cotas del mismo tamaño en px
// pero con labels distintos — muestra el contraste átomo vs objeto macroscópico.
function drawMacroComparisonCota(theme, cx, cy, atomR, el) {
  const info = MACRO_OBJECTS[el.id];
  if (!info) return;

  const ink      = inkText(theme);
  const atomCol  = zoomArrowColor(0);
  const macroCol = theme === "high-contrast" ? [0, 255, 136] : [34, 197, 94];
  const y        = cy + atomR + 24;
  const halfPx   = width * 0.20;

  drawCotaLine(width * 0.25, y, halfPx, atomCol,
    "D = " + formatLength(el.atomDiameterM),
    "Átomo de " + el.name, ink, false);

  const label = info.label.charAt(0).toUpperCase() + info.label.slice(1);
  drawCotaLine(width * 0.75, y, halfPx, macroCol,
    "≈ " + formatLength(info.sizeM),
    label, ink, false);
}

// Recuadro verde centrado que aparece al llegar a escala macroscópica.
function drawMacroInfoBox(theme, el) {
  const info = MACRO_OBJECTS[el.id];
  if (!info) return;
  const card = cardColors(theme);
  const col  = theme === "high-contrast" ? [0, 255, 136] : [34, 197, 94];

  const sizeStr = formatLength(info.sizeM);
  const msgs = {
    "H":  "Ahora vemos un cubito de hielo (≈ " + sizeStr + "). Está formado por moléculas de H₂O. A esta escala los átomos individuales son completamente invisibles.",
    "O":  "Ahora vemos un cubito de hielo (≈ " + sizeStr + "). Está formado por moléculas de H₂O. A esta escala los átomos individuales son completamente invisibles.",
    "Na": "Ahora vemos un grano de sal (≈ " + sizeStr + "). El NaCl forma un cristal cúbico perfecto, visible a simple vista.",
    "Cl": "Ahora vemos un grano de sal (≈ " + sizeStr + "). El NaCl forma un cristal cúbico perfecto, visible a simple vista.",
    "Fe": "Ahora vemos un clavo de hierro (≈ " + sizeStr + " de largo). Sus cristales BCC que vimos antes forman este objeto cotidiano.",
    "Au": "Ahora vemos un anillo de oro (≈ " + sizeStr + " de diámetro). Sus átomos en red FCC forman este objeto macroscópico.",
  };
  const msg = msgs[el.id] || "";
  const boxW = Math.min(290, Math.max(210, width * 0.4));
  const pad  = 14;
  const x    = Math.round(width / 2 - boxW / 2);
  const y    = 20;

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

  rectMode(CORNER);
  stroke(col[0], col[1], col[2], 190);
  strokeWeight(1.2);
  fill(card.bg[0], card.bg[1], card.bg[2], 230);
  rect(x, y, boxW, boxH, 9);

  noStroke();
  fill(col[0], col[1], col[2]);
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
