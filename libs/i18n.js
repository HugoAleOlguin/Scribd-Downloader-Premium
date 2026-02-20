/**
 * Scribd Premium Downloader
 * Translations Library
 * @version 2.4.0
 */

const I18n = {
    es: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Suite de Descarga",
            status: "Extensión Activa",
            how_to: "CÓMO USAR",
            step1: "Navega a un documento de <strong>Scribd</strong>.",
            step2: "Usa el panel flotante en pantalla.",
            step3: "Selecciona tu método de descarga preferido.",
            footer: "Version 2.4.0 Premium"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "ID Doc:",
            file: "Archivo:",
            pages: "Páginas:",
            analyzing: "Analizando...",
            activate: "ACTIVAR MODO DESCARGA",
            hq_btn: "ESCANEO INTELIGENTE (HQ)",
            hq_badge: "100% SEGURO",
            hq_tooltip: "Captura cada página como imagen de alta resolución. Sólido y fiable si otros métodos fallan.",
            adv_opts: "OPCIONES AVANZADAS",
            vec_btn: "PDF ORIGINAL",
            vec_badge: "AUTO",
            vec_tooltip: "Intenta automatizar la extracción del archivo PDF original desde servidores externos.",
            states: {
                loading: "Preparando...",
                saving: "Guardando...",
                success: "¡Listo!",
                error: "Error: "
            }
        },
        toast: {
            init: { title: "Iniciando", desc: "Conectando..." },
            verify: { title: "Verificación", desc: "Resolviendo seguridad..." },
            wait: { title: "Generando Enlace", desc: "Sincronizando..." },
            redirect: { title: "Redirigiendo", desc: "Entrando a fase final..." },
            analyzing: { title: "Analizando Documento", desc: "Buscando flujo de datos..." },
            validating: { title: "Verificando Integridad", desc: "Comprobando tamaño del archivo..." },
            success: { title: "¡Documento Validado!", desc: "Descarga iniciada." },
            error_damaged: { title: "Archivo Dañado", desc: "El PDF está vacío o corrupto.", help: "<b>Descarga Fallida:</b><br/>El archivo PDF original no está disponible o está dañado. <br/><br/>👉 <b>Solución:</b> Cierra esta pestaña y usa la opción <b>'Escaneo HQ'</b> en la extensión." },
            error_timeout: { title: "Tiempo Agotado", desc: "El servidor no respondió." }
        }
    },
    en: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Download Suite",
            status: "Extension Active",
            how_to: "HOW TO USE",
            step1: "Navigate to any <strong>Scribd</strong> document.",
            step2: "Use the floating panel on screen.",
            step3: "Select your preferred download method.",
            footer: "Version 2.4.0 Premium"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "Doc ID:",
            file: "File:",
            pages: "Pages:",
            analyzing: "Analyzing...",
            activate: "ACTIVATE DOWNLOAD MODE",
            hq_btn: "SMART SCAN (HQ)",
            hq_badge: "100% SAFE",
            hq_tooltip: "Captures each page as a high-res image. Solid and reliable if other methods fail.",
            adv_opts: "ADVANCED OPTIONS",
            vec_btn: "ORIGINAL PDF",
            vec_badge: "AUTO",
            vec_tooltip: "Attempts to automate original PDF extraction from external servers.",
            states: {
                loading: "Preparing...",
                saving: "Saving...",
                success: "Done!",
                error: "Error: "
            }
        },
        toast: {
            init: { title: "Starting", desc: "Connecting..." },
            verify: { title: "Verification", desc: "Solving security..." },
            wait: { title: "Generating Link", desc: "Synchronizing..." },
            redirect: { title: "Redirecting", desc: "Entering final phase..." },
            analyzing: { title: "Analyzing Document", desc: "Searching data stream..." },
            validating: { title: "Verifying Integrity", desc: "Checking file size..." },
            success: { title: "Document Validated!", desc: "Download started." },
            error_damaged: { title: "File Damaged", desc: "PDF is empty or corrupt.", help: "<b>Download Failed:</b><br/>Original PDF file is not available or damaged. <br/><br/>👉 <b>Solution:</b> Close this tab and use the <b>'Smart Scan (HQ)'</b> option in the extension." },
            error_timeout: { title: "Timed Out", desc: "Server did not respond." }
        }
    }
};

// Export for different contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
} else if (typeof window !== 'undefined') {
    window.I18n = I18n; // Content Script / Popup
}
// Service Worker context handles this differently via importScripts or copy-paste
