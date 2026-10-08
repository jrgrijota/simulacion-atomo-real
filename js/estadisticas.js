// Estadísticas de uso sin cookies (GoatCounter).
// Dentro de simulaciencia.es no hace nada: esas visitas ya las cuenta el portal.
// Fuera de él registra /embed/<sim> (incrustada en otra web, que aparece como
// procedencia) o /directo/<sim> (abierta por su propia dirección).
(function () {
  var sim = document.currentScript.dataset.sim;
  var framed = window.top !== window.self;
  var host = '';
  if (framed) {
    var parentUrl = (location.ancestorOrigins && location.ancestorOrigins[0]) || document.referrer;
    try { host = new URL(parentUrl).hostname; } catch (e) {}
  }
  if (/^(www\.)?simulaciencia\.es$|^localhost$|^127\./.test(host)) return;

  var gc = document.createElement('script');
  gc.async = true;
  gc.src = 'https://gc.zgo.at/count.js';
  gc.dataset.goatcounter = 'https://jrgrijota.goatcounter.com/count';
  gc.dataset.goatcounterSettings = '{"no_onload": true, "allow_frame": true}';
  gc.onload = function () {
    window.goatcounter.count({ path: (framed ? '/embed/' : '/directo/') + sim, title: document.title });
  };
  document.head.appendChild(gc);
})();
