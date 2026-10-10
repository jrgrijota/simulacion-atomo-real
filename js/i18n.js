// Idioma de la interfaz. Español por defecto; con ?lang=en se muestra en inglés,
// con ?lang=ca en catalán y con ?lang=eu en euskera (es lo que cargan
// simulaciencia.es/en/, /ca/ y /eu/). Las traducciones están en js/i18n-en.js,
// js/i18n-ca.js y js/i18n-eu.js, diccionarios «texto en español» → «texto traducido».
//
//  · El HTML no se toca: al cargar, los textos (y los atributos title, placeholder,
//    aria-label y alt) que coinciden exactamente con una clave se sustituyen.
//    Un elemento con data-i18n="clave" recibe como innerHTML la traducción de
//    «clave» (para frases con <b>, <sub>… dentro).
//  · En JS, i18n.t('Texto con {n} valores', { n: 3 }) devuelve el texto en el
//    idioma activo, i18n.num(1.5, 2) escribe el número con coma (es, ca, eu) o punto (en)
//    e i18n.lang dice el idioma ('es', 'en', 'ca' o 'eu'). Si hay HTML nuevo con textos fijos,
//    i18n.translateTree(elemento) lo traduce igual que al cargar.
//  · Si falta una traducción, se queda en español.
(function () {
  var param = new URLSearchParams(location.search).get('lang');
  var DICTS = { en: window.I18N_EN, ca: window.I18N_CA, eu: window.I18N_EU };
  var lang = Object.prototype.hasOwnProperty.call(DICTS, param) ? param : 'es';
  var dict = DICTS[lang] || {};

  function lookup(es) {
    return Object.prototype.hasOwnProperty.call(dict, es) ? dict[es] : es;
  }

  function t(es, vars) {
    var s = lookup(es);
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : s;
  }

  function num(n, digits) {
    var s = digits == null ? String(n) : Number(n).toFixed(digits);
    return lang === 'en' ? s : s.replace('.', ',');
  }

  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

  function translateTree(root) {
    if (lang === 'es' || !root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var tag = node.parentNode && node.parentNode.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      var raw = node.nodeValue;
      var key = raw.trim();
      if (key && Object.prototype.hasOwnProperty.call(dict, key)) node.nodeValue = raw.replace(key, dict[key]);
    }
    var els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      for (var j = 0; j < ATTRS.length; j++) {
        var v = el.getAttribute(ATTRS[j]);
        if (v && Object.prototype.hasOwnProperty.call(dict, v.trim())) el.setAttribute(ATTRS[j], dict[v.trim()]);
      }
      var k = el.getAttribute('data-i18n');
      if (k && Object.prototype.hasOwnProperty.call(dict, k)) el.innerHTML = dict[k];
    }
  }

  window.i18n = { lang: lang, t: t, num: num, translateTree: translateTree };

  if (lang === 'es') return;
  document.documentElement.lang = lang;
  if (Object.prototype.hasOwnProperty.call(dict, document.title)) document.title = dict[document.title];
  function run() { translateTree(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
