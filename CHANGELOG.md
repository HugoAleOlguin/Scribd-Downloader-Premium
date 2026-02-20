# 📄 CHANGELOG (Evolución del Proyecto)

## [2.3.0] - 2026-02-20: **Integrity Check**
- **Smart Validation**: Implementado un sistema de "Pre-flight Check" que verifica la integridad del archivo PDF (tamaño > 2KB y tipo MIME) antes de descargarlo.
- **Error Fallback**: Si el PDF remoto está corrupto o vacío (bug común en vDownloaders), ahora se muestra un error claro sugiriendo el uso del "Escaneo HQ".
- **Native Download**: Migración a `chrome.downloads` API para mayor estabilidad.

## [2.2.0] - 2026-02-20: **Release Candidate (GitHub)**
- **Refactoring**: Limpieza completa del código fuente.
- **UI Popup**: Nuevo diseño estilo GitHub/Vercel.
- **Background**: Estandarización de código.

## [2.1.0] - 2026-02-20: **Premium Rebranding**
- **Nuevo Nombre**: "Scribd Premium Downloader".
- **UI Overlay**: Incorporación de Tooltips y badges.
- **Timeout Fix**: Aumento a 30s.

## [2.0.0] - 2026-02-20: **Mission Control UI**
- **Notificaciones**: Panel de control flotante.
- **Feedback Visual**: Animaciones Glassmorphism.

## [1.9.5] - 2026-02-20: **Autopilot Stable**
- **Logic Fix**: Evitación de bucles infinitos.
- **Timer Skip**: Detección inteligente.

## [1.9.0] - 2026-02-20: **The Bridge (Autopilot)**
- **Automatización**: Soporte para Captchas y navegación externa.
