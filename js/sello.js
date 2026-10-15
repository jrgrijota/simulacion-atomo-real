// Sello «simulaciencia.es»: etiqueta pequeña en una esquina de la zona de simulación,
// enlazada a la web (a la portada del idioma activo), para que se sepa de dónde viene
// la simulación también cuando otra web la embebe.
// Se configura con atributos de la etiqueta <script>:
//   data-contenedor  selector del elemento sobre el que se coloca
//   data-esquina     tl, tc, tr, bl, br (arriba/abajo, izquierda/centro/derecha)
//   data-esquina-movil  esquina con pantalla estrecha (opcional)
//   data-ancho-movil    ancho máximo en px que se considera móvil (por defecto 820)
//   data-margen-derecho  separación del borde derecho en px (por defecto 12), para no tapar un botón
//   data-arriba-movil    con pantalla estrecha, separación del borde superior en px (para dejar libre un rótulo)
(function () {
  var script = document.currentScript;
  var cfg = script ? script.dataset : {};
  var LANGS = { en: 1, ca: 1, eu: 1, gl: 1 };
  var lang = window.i18n && LANGS[window.i18n.lang] ? window.i18n.lang : null;
  var url = 'https://simulaciencia.es/' + (lang ? lang + '/' : '');
  var derecho = (parseInt(cfg.margenDerecho, 10) || 12) + 'px';

  var POS = {
    tl: 'top:12px;left:12px;right:auto;bottom:auto;transform:none',
    tc: 'top:12px;left:50%;right:auto;bottom:auto;transform:translateX(-50%)',
    tr: 'top:12px;right:' + derecho + ';left:auto;bottom:auto;transform:none',
    bl: 'bottom:12px;left:12px;right:auto;top:auto;transform:none',
    br: 'bottom:12px;right:' + derecho + ';left:auto;top:auto;transform:none'
  };
  var esquina = POS[cfg.esquina] ? cfg.esquina : 'bl';
  var css =
    '.sc-sello{position:absolute;z-index:40;display:flex;align-items:center;gap:6px;' +
    'padding:4px 10px 4px 6px;border-radius:999px;background:rgba(15,23,42,.72);' +
    'border:1px solid rgba(125,211,252,.3);font:600 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
    'color:#e0f2fe;text-decoration:none;white-space:nowrap;opacity:.85;' +
    '-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:opacity .15s,border-color .15s;' +
    POS[esquina] + '}' +
    '.sc-sello:hover,.sc-sello:focus-visible{opacity:1;border-color:rgba(125,211,252,.7)}' +
    '.sc-sello svg{flex:none;display:block}';
  if (POS[cfg.esquinaMovil]) {
    var movil = POS[cfg.esquinaMovil];
    if (cfg.arribaMovil) movil = movil.replace('top:12px', 'top:' + parseInt(cfg.arribaMovil, 10) + 'px');
    css += '@media (max-width:' + (parseInt(cfg.anchoMovil, 10) || 820) + 'px){.sc-sello{' + movil + '}}';
  }

  function poner() {
    var cont = document.querySelector(cfg.contenedor || 'body');
    if (!cont) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
    var a = document.createElement('a');
    a.className = 'sc-sello';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = window.i18n ? window.i18n.t('Más simulaciones en simulaciencia.es') : 'Más simulaciones en simulaciencia.es';
    a.innerHTML =
      '<svg viewBox="0 0 64 64" width="14" height="14" aria-hidden="true">' +
      '<rect width="64" height="64" rx="14" fill="#0284c7"/>' +
      '<g fill="none" stroke="#fff" stroke-width="4"><ellipse cx="32" cy="32" rx="24" ry="9"/>' +
      '<ellipse cx="32" cy="32" rx="24" ry="9" transform="rotate(60 32 32)"/>' +
      '<ellipse cx="32" cy="32" rx="24" ry="9" transform="rotate(120 32 32)"/></g>' +
      '<circle cx="32" cy="32" r="5" fill="#00c8ff"/></svg><span>simulaciencia.es</span>';
    cont.appendChild(a);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner);
  else poner();
})();
