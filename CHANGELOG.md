# 📄 CHANGELOG (Evolución del Proyecto)

## [2.3.0] - 2026-02-20: **Integrity Check**
- **Smart Validation**: Implementado un sistema de "Pre-flight Check" que verifica la integridad del archivo PDF (tamaño > 2KB y tipo MIME) antes de descargarlo.
- **Error Fallback**: Si el PDF remoto está corrupto o vacío (bug común en vDownloaders), ahora se muestra un error claro sugiriendo el uso del "Escaneo HQ".
- **Native Download**: Migración a `chrome.downloads` API para mayor estabilidad.

## [2.2.0] - 2026-02-20: **Release Candidate (GitHub)**
- **Refactoring**: Limpieza completa del código fuente para eliminar logs de depuración y comentarios internos.
- **UI Popup**: Nuevo diseño estilo GitHub/Vercel (Inter Font, Dark Mode) con enlace destacado al repositorio.
- **Background**: Estandarización de nombres de variables y funciones (paso de `automationState` a `AppState`).
- **Docs**: README.md profesional y adaptado para GitHub.
- **Cleanup**: Eliminación de archivos legacy (`manager.js`, `manager.html`).

## [2.1.0] - 2026-02-20: **Premium Rebranding**
- **Nuevo Nombre**: "Scribd Premium Downloader".
- **UI Overlay**: Incorporación de Tooltips explicativos y badges (HQ, AUTO, BETA).
- **Error Handling**: Aumento del timeout de espera a 30s para conexiones lentas.
- **Smart Feedback**: El sistema de notificaciones ahora sugiere el método alternativo si uno falla.

## [2.0.0] - 2026-02-20: **Mission Control UI**
- **Notificaciones**: Reemplazo de los "Toasts" simples por un panel de control flotante con barra de progreso.
- **Iconos**: Nuevos iconos vectoriales para cada estado (Iniciando, Verificando, Descargando).
- **Feedback Visual**: Animaciones de entrada/salida y estilos Glassmorphism.

## [1.9.5] - 2026-02-20: **Autopilot Stable**
- **Logic Fix**: Implementación de lógica mutuamente exclusiva para evitar bucles infinitos entre pantallas de espera.
- **Timer Skip**: Detección inteligente del enlace final incluso antes de que el contador llegue a cero.

## [1.9.0] - 2026-02-20: **The Bridge (Autopilot)**
- **Automatización**: Soporte para resolver Captchas (Turnstile) y navegar automáticamente por sitios de descarga externos.
- **Multi-Tab**: Gestión de pestañas y comunicación segura entre Content Script y Background Script.

## [1.5.0] - 2026-01-15: **Image Processing Engine**
- **PDF Generation**: Integración de `jspdf` para ensamblar imágenes en un solo archivo PDF.
- **Auto-Scroll**: Script de desplazamiento automático para cargar todas las páginas (Lazy Loading).
- **Zoom Optimization**: Ajuste automático del zoom del navegador para capturar la máxima resolución posible.

## [1.0.0] - 2025-12-01: **Initial Release**
- **Core Feature**: Capacidad básica de captura de pantalla de documentos Scribd.
- **UI**: Botones inyectados en la interfaz de Scribd.
- **Storage**: Sistema básico de guardado de nombres de archivos.
