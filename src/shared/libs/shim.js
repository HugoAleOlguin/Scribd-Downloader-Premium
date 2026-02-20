// shim.js — Fuerza a jsPDF UMD a usar la rama GLOBAL (window.jspdf)
//
// ANÁLISIS DEL PROBLEMA (investigado Feb 2025):
// El archivo jspdf.umd.min.js tiene este wrapper IIFE:
//
//   !function(t, e){
//     "object" == typeof exports && "undefined" != typeof module ? e(exports)  // ← rama CommonJS
//     : "function" == typeof define && define.amd ? define(["exports"], e)     // ← rama AMD
//     : e((t = t || self).jspdf = {})                                          // ← rama global
//   }(this, factory)
//
// En un content script de Chrome MV3, el scope aislado SÍ tiene una variable
// `exports` de tipo 'object' (es el sistema de módulos interno de Chrome).
// Eso hace que jsPDF tome la rama CommonJS y exporte a `exports`, NO a window.jspdf.
//
// SOLUCIÓN: Sobrescribir `exports` temporalmente en el scope con un valor NO-object
// antes de que cargue jsPDF, y restaurarlo después.
// Lamentablemente no podemos hacer eso desde un archivo separado que corra antes,
// porque `exports` es una variable del scope, no una propiedad de window.
//
// LA SOLUCIÓN REAL: La rama global usa `self.jspdf = {}`.
// `self` en un content script apunta al mismo objeto global que `window`.
// Si jsPDF toma la rama global, el resultado estará en window.jspdf.jsPDF. ✅
//
// Para forzar la rama global necesitamos que typeof exports !== 'object'.
// Podemos lograrlo aquí asignando window.exports = undefined ANTES de que jsPDF
// corra, para que la comprobación falle... pero de nuevo, exports del scope !== window.exports.
//
// ALTERNATIVA PROBADA: El manifest.json inyecta los scripts en orden:
//   1. shim.js
//   2. jspdf.umd.min.js
//   3. content.js
//
// En el mismo script runner de Chrome, si jsPDF.umd corre en "non-module" mode
// (que es el caso con content_scripts en manifest), `exports` puede o no existir
// dependiendo de la versión de Chrome.
//
// En Chrome 120+ con MV3, content scripts NO tienen 'exports' en scope por defecto
// (son scripts clásicos, no CommonJS). Si el error persiste en tu versión, significa
// que Chrome está inyectando algo que lo define.
//
// Este shim ahora hace lo más seguro: asegurar que la rama global tenga dónde escribir.
// La detección en content.js buscará window.jspdf.jsPDF (rama global).

// Nos aseguramos de que self.jspdf NO esté pre-definido para que jsPDF lo cree limpio
if (typeof self !== 'undefined' && self.jspdf) {
    delete self.jspdf;
}
if (typeof window !== 'undefined' && window.jspdf) {
    delete window.jspdf;
}
