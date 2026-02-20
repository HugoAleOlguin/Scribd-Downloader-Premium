# 📄 CHANGELOG (Evolución del Proyecto)

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
