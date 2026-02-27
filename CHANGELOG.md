# 📄 CHANGELOG (Evolución del Proyecto)

## [2.7.0] - 2026-02-27: **Firefox HQ Scan Fix**

### 🐛 Bug Fix
- **Fix crítico — imágenes recortadas en Firefox**: El zoom implementado con `transform:scale` era visual-only y no generaba un reflow del DOM. Por esto, `scrollIntoView` seguía usando coordenadas pre-escala y `captureVisibleTab` capturaba el mismo viewport recortado de siempre, sin importar el nivel de zoom aplicado. Reemplazado por `documentElement.style.zoom` (soportado desde Firefox 126, abril 2024), que sí fuerza un reflow completo del layout, equivalente al `body.style.zoom` de Chrome. Ahora ambos navegadores usan el mismo mecanismo.
- **Unificación de la lógica de zoom**: Eliminada la bifurcación `isFirefox`. `applyZoom` y `resetZoom` ahora son idénticos para Chrome y Firefox.

### 🔖 Versión
- Bump de versión a `2.7.0` en todos los archivos: manifiestos, headers JSDoc, popup UI.

---

## [2.5.6] - 2026-02-23: **Large Document UX + Chunked PDF**

### 🐛 Bug Fix
- **Fix crítico — "invalid string length"**: Al descargar documentos con cientos de páginas, el motor V8 lanzaba `RangeError: Invalid string length` porque jsPDF acumulaba todas las páginas en un único string base64 gigante. Ahora el escaneo HQ se divide en **lotes de 100 páginas** (`PAGES_PER_CHUNK`), generando un archivo PDF por lote (ej. `doc_parte_1_de_11.pdf`). La memoria se libera entre lotes. Para documentos ≤ 100 páginas el comportamiento es idéntico al anterior (un solo archivo).

### ✨ UX — Documentos Grandes (≥ 100 páginas)
- **Banner de advertencia**: Se muestra un panel ámbar animado con un botón de acceso directo a "PDF Original" cuando se detecta un documento grande. Recomendado porque evita el proceso de escaneo HQ (que puede tardar horas).
- **Simplificación del overlay**: Cuando el banner de advertencia está visible, el botón duplicado "PDF Original" de la sección "Opciones Avanzadas" se oculta automáticamente para limpiar la UI.
- **Mini-aviso al iniciar HQ Scan**: Si el usuario elige igualmente el Escaneo HQ en un documento grande, aparece un texto no intrusivo debajo del botón (`⏱ Esto tardará mucho tiempo. Manteté esta pestaña abierta.`) antes de iniciar el proceso.
- **Traducciones**: Nuevas claves `large_doc_warning` y `hq_long_warning` en ES e EN en `i18n.js`.

---

## [2.5.5] - 2026-02-20: **Monorepo + Firefox Fix**


### Estructura
- **Monorepo**: Reorganización completa del proyecto en `src/shared/`, `src/chrome/` y `src/firefox/`. Una única fuente de verdad para el código compartido.
- **Build system**: Reemplazado el script `.ps1` por `build.bat` (doble clic, sin restricciones de ejecución). Genera `chrome/` y `firefox/` directamente en la raíz del proyecto.
- **Cleanup**: Eliminados todos los archivos duplicados de la raíz (`manifest.json`, `background.js`, `content.js`, `overlay.css`, `popup.html`, `popup.js`, `icons/`, `libs/`, `manifest-firefox.json`, scripts legacy).

### Firefox
- **Fix crítico**: `captureVisibleTab` ahora usa `windowId` explícito (Firefox rechaza `null`).
- **Fix zoom**: `document.body.style.zoom` no es estándar en Firefox. Reemplazado por `transform: scale()` con detección automática de navegador.
- **Fix CORS**: `validate_download` ahora maneja la ausencia de `content-length` (Firefox lo omite por CORS).


## [2.4.3] - 2026-02-20: **Filename Fix & jsPDF Loader**
- **UX Fix**: La descarga de PDF externo (vía "PDF Original") ahora guarda el archivo con el nombre real del documento en lugar del nombre genérico `Scribd_Document_Premium.pdf`. El nombre fluye desde el overlay → background → chrome.downloads.
- **Loader Fix**: Corregida la detección de jsPDF en content scripts de Chrome MV3. El shim anterior intentaba simular CommonJS con `window.module`, lo cual era inefectivo. El nuevo enfoque deja que jsPDF use su rama global (`window.jspdf.jsPDF`) y simplifica `getJsPDF()` a las rutas reales.
- **Cleanup**: Eliminado el bloque de logs de diagnóstico temporal de `content.js`.

## [2.4.2] - 2026-02-20: **Hotfix (jsPDF)**
- **Crash Fix**: Implementado un sistema de "fallback" robusto en el `content.js` para evitar caídas si la librería `jsPDF` no se carga correctamente (por ejemplo, si el usuario olvida recargar la extensión tras actualizar).
- **Update**: Sincronización de versiones en todos los manifiestos.

## [2.4.1] - 2026-02-20: **Hotfix (I18n Safety)**
- **Crash Fix**: Implementado un sistema de "fallback" robusto en el `content.js` para evitar caídas si la librería `i18n.js` no se carga correctamente (por ejemplo, si el usuario olvida recargar la extensión tras actualizar).
- **Update**: Sincronización de versiones en todos los manifiestos.

## [2.4.0] - 2026-02-20: **International Release (i18n)**
- **Multi-Language Support**: Nueva opción en el popup para cambiar entre **Español (ES)** e **Inglés (EN)** en tiempo real.
- **Full Translation**: Todos los elementos de la interfaz, tooltips, notificaciones y errores ahora están disponibles en ambos idiomas.
- **Firefox MV3 Compatibility**: Añadido soporte oficial para Firefox mediante `manifest-firefox.json` (soluciona el error de `service_worker disabled`).
- **Core Optimization**: Refactorización del manejo de estados para soportar textos dinámicos sin recargar la extensión.

## [2.3.1] - 2026-02-20: **Chrome Compatibility & Stealth Fix**
- **Scribd Detection Fix**: Corregido un error donde Scribd bloqueaba el acceso (Adblock Warning) al inyectar scripts en iframes publicitarios. Ahora la inyección está limitada a `all_frames: false`.
- **Chrome MV3 Fix**: Migración completa a Service Workers (`background.service_worker`) para cumplir con los estándares estrictos de Chrome Web Store.
- **State Persistence**: Implementación de `chrome.storage.local` para mantener el estado de la automatización vivo entre suspensiones del navegador.

## [2.3.0] - 2026-02-20: **Integrity Check**
- **Smart Validation**: Implementado un sistema de "Pre-flight Check" que verifica la integridad del archivo PDF (tamaño > 2KB y tipo MIME) antes de descargarlo.
- **Error Fallback**: Si el PDF remoto está corrupto o vacío (bug común en vDownloaders), ahora se muestra un error claro sugiriendo el uso del "Escaneo HQ".
- **Native Download**: Migración a `chrome.downloads` API para mayor estabilidad.

## [2.2.0] - 2026-02-20: **Release Candidate (GitHub)**
- **Refactoring**: Limpieza completa del código fuente.
- **UI Popup**: Nuevo diseño estilo GitHub/Vercel.
- **Background**: Estandarización de nombres.
- **Docs**: README.md profesional.
- **Cleanup**: Eliminación de archivos legacy.

## [2.1.0] - 2026-02-20: **Premium Rebranding**
- **Nuevo Nombre**: "Scribd Premium Downloader".
- **UI Overlay**: Incorporación de Tooltips y badges.
- **Error Handling**: Aumento del timeout de espera a 30s.

## [2.0.0] - 2026-02-20: **Mission Control UI**
- **Notificaciones**: Reemplazo de los "Toasts" simples.
- **Iconos**: Nuevos iconos vectoriales.
- **Feedback Visual**: Animaciones Glassmorphism.

## [1.9.5] - 2026-02-20: **Autopilot Stable**
- **Logic Fix**: Evitación de bucles infinitos.
- **Timer Skip**: Detección inteligente.

## [1.9.0] - 2026-02-20: **The Bridge (Autopilot)**
- **Automatización**: Soporte para Captchas.
- **Multi-Tab**: Gestión de pestañas.

## [1.5.0] - 2026-01-15: **Image Processing Engine**
- **PDF Generation**: Integración de `jspdf`.
- **Auto-Scroll**: Script de carga diferida.
- **Zoom Optimization**: Ajuste automático del zoom.

## [1.0.0] - 2025-12-01: **Initial Release**
- **Core Feature**: Captura de pantalla básica.
- **UI**: Botones inyectados.
- **Storage**: Sistema básico de guardado.
