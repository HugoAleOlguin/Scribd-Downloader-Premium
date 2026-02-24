/**
 * Scribd Premium Downloader
 * Translations Library
 * @version 2.4.1
 */

const I18n = {
    es: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Suite de Descarga",
            status: "Extensión Activa y Lista",
            how_to: "CÓMO USAR",
            // Instrucciones detalladas y específicas para el usuario hispanohablante
            step1: "Abre cualquier documento en <strong>Scribd</strong> (libros, artículos, presentaciones, etc.). Asegúrate de que el documento sea accesible.",
            step2: "Aparecerá un <strong>panel flotante</strong> en la esquina de la pantalla. Si no lo ves, recarga la página con F5.",
            step3: "Elige <strong>'Escaneo HQ'</strong> para capturar página a página o <strong>'PDF Original'</strong> para intentar descargar el archivo nativo.",
            footer: "v2.5.6 Premium — Código Abierto"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "ID Doc:",
            file: "Archivo:",
            pages: "Páginas:",
            analyzing: "Contando páginas...",
            activate: "▶ ACTIVAR MODO DESCARGA",
            // Botón principal: escaneo página a página con captura de pantalla
            hq_btn: "ESCANEO INTELIGENTE (HQ)",
            hq_badge: "100% SEGURO",
            hq_tooltip: "Captura cada página individualmente como imagen PNG de alta resolución y las ensambla en un PDF. Funciona aunque el documento tenga restricciones de descarga.",
            // Sección de opciones avanzadas
            adv_opts: "OPCIONES AVANZADAS",
            // Botón secundario: extracción del PDF original
            vec_btn: "PDF ORIGINAL",
            vec_badge: "AUTOMÁTICO",
            vec_tooltip: "Intenta descargar el archivo PDF original desde servidores externos. Más rápido, pero puede fallar si el servidor no lo expone. Si falla, usa 'Escaneo HQ'.",
            // Aviso para documentos con muchas páginas: recomienda PDF Original
            large_doc_warning: "⚠️ Documento grande detectado ({pages} páginas). El Escaneo HQ generará múltiples archivos y tardará horas. Se recomienda 100% usar \"PDF Original\".",
            // Mini-aviso que aparece al hacer click en Escaneo HQ con doc grande
            hq_long_warning: "⏱ Esto tardará mucho tiempo. Mantené esta pestaña abierta.",
            // Estados dinámicos del botón durante el proceso
            states: {
                loading: "Preparando escaneo...",
                saving: "Generando PDF...",
                success: "¡PDF Guardado!",
                error: "Error: "
            },
            // Mensajes de error específicos con contexto
            errors: {
                pdf_lib: "Recarga la página (F5) e intenta de nuevo.",
                no_pages: "No se encontraron páginas. ¿Estás en un documento de Scribd?",
                capture: "Error de captura. Verifica los permisos de la extensión."
            }
        },
        toast: {
            init: { title: "Iniciando", desc: "Conectando al servidor..." },
            verify: { title: "Verificación de Seguridad", desc: "Resolviendo protección Cloudflare..." },
            verify_done: { title: "Verificación Completada", desc: "Accediendo al documento..." },
            wait: { title: "Generando Enlace de Descarga", desc: "Sincronizando con servidor externo..." },
            redirect: { title: "Redirigiendo", desc: "Entrando a la fase final de descarga..." },
            analyzing: { title: "Analizando Documento", desc: "Localizando el flujo de datos del PDF..." },
            validating: { title: "Verificando Integridad", desc: "Comprobando tamaño y formato del archivo..." },
            success: { title: "¡Documento Validado!", desc: "La descarga ha comenzado." },
            error_damaged: {
                title: "Archivo No Disponible",
                desc: "El PDF original está vacío o dañado.",
                help: "<b>Descarga Fallida:</b><br/>El archivo PDF original no está disponible o está dañado en el servidor externo. <br/><br/>👉 <b>Solución:</b> Cierra esta pestaña y usa la opción <b>'Escaneo HQ'</b> en el panel de la extensión. Este método alternativo funciona en casi todos los documentos."
            },
            error_timeout: { title: "Tiempo de Espera Agotado", desc: "El servidor externo no respondió. Inténtalo de nuevo en unos minutos." }
        }
    },
    en: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Download Suite",
            status: "Extension Active & Ready",
            how_to: "HOW TO USE",
            // Detailed and specific instructions for English-speaking users
            step1: "Open any document on <strong>Scribd</strong> (books, articles, presentations, etc.). Make sure the document page is fully loaded.",
            step2: "A <strong>floating panel</strong> will appear in the corner of the screen. If you don't see it, reload the page with F5.",
            step3: "Choose <strong>'Smart Scan (HQ)'</strong> to capture each page individually (recommended) or <strong>'Original PDF'</strong> to attempt a direct native download.",
            footer: "v2.5.6 Premium — Open Source"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "Doc ID:",
            file: "File:",
            pages: "Pages:",
            analyzing: "Counting pages...",
            activate: "▶ ACTIVATE DOWNLOAD MODE",
            // Main button: page-by-page screenshot scan
            hq_btn: "SMART SCAN (HQ)",
            hq_badge: "100% SAFE",
            hq_tooltip: "Captures each page individually as a high-resolution PNG image and assembles them into a PDF. Works even if the document has download restrictions.",
            // Advanced options section
            adv_opts: "ADVANCED OPTIONS",
            // Secondary button: original PDF extraction
            vec_btn: "ORIGINAL PDF",
            vec_badge: "AUTOMATIC",
            vec_tooltip: "Attempts to download the original PDF file from external servers. Faster, but may fail if the server doesn't expose it. If it fails, use 'Smart Scan (HQ)'.",
            // Warning for documents with many pages: recommends Original PDF
            large_doc_warning: "⚠️ Large document detected ({pages} pages). HQ Scan will generate multiple files and take hours. 100% recommended: use \"Original PDF\".",
            // Mini-warning shown when clicking HQ Scan on a large document
            hq_long_warning: "⏱ This will take a long time. Please keep this tab open.",
            // Dynamic button states during the process
            states: {
                loading: "Preparing scan...",
                saving: "Generating PDF...",
                success: "PDF Saved!",
                error: "Error: "
            },
            // Specific error messages with context
            errors: {
                pdf_lib: "Reload the page (F5) and try again.",
                no_pages: "No pages found. Are you on a Scribd document?",
                capture: "Capture error. Check the extension permissions."
            }
        },
        toast: {
            init: { title: "Starting", desc: "Connecting to server..." },
            verify: { title: "Security Verification", desc: "Solving Cloudflare protection..." },
            verify_done: { title: "Verification Complete", desc: "Accessing document..." },
            wait: { title: "Generating Download Link", desc: "Synchronizing with external server..." },
            redirect: { title: "Redirecting", desc: "Entering final download phase..." },
            analyzing: { title: "Analyzing Document", desc: "Locating PDF data stream..." },
            validating: { title: "Verifying Integrity", desc: "Checking file size and format..." },
            success: { title: "Document Validated!", desc: "Download has started." },
            error_damaged: {
                title: "File Unavailable",
                desc: "The original PDF is empty or corrupted.",
                help: "<b>Download Failed:</b><br/>The original PDF file is not available or is corrupted on the external server. <br/><br/>👉 <b>Solution:</b> Close this tab and use the <b>'Smart Scan (HQ)'</b> option in the extension panel. This alternative method works on almost all documents."
            },
            error_timeout: { title: "Request Timed Out", desc: "The external server did not respond. Try again in a few minutes." }
        }
    }
};

// Exportar para distintos contextos de ejecución
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
} else if (typeof window !== 'undefined') {
    window.I18n = I18n; // Content Script / Popup
}
// El Service Worker maneja esto por separado con su copia embebida en background.js
