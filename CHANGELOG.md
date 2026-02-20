# 📄 CHANGELOG (Evolución del Proyecto)

## [2.2.0] - 2026-02-20: **Release Candidate**
- **Refactoring**: Limpieza completa del código fuente para eliminar logs de depuración y comentarios internos.
- **UI Popup**: Nuevo diseño estilo GitHub/Vercel (Inter Font, Dark Mode) con enlace destacado al repositorio.
- **Background**: Estandarización de nombres de variables y funciones (paso de `automationState` a `AppState`).
- **Docs**: README.md profesional y adaptado para GitHub.

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
