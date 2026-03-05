/**
 * Scribd Premium Downloader
 * Translations Library
 * @version 2.8.0
 */

const I18n = {
    es: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Descargador de documentos",
            status: "Lista para usar",
            how_to: "¿CÓMO FUNCIONA?",
            // Instrucciones claras y sin tecnicismos
            step1: "Abre cualquier documento en <strong>Scribd</strong> que quieras guardar (libro, apunte, presentación, etc.).",
            step2: "Aparecerá un <strong>panel flotante</strong> en la pantalla. Si no lo ves, recarga la página con F5.",
            step3: "Pulsa <strong>'Escaneo Premium'</strong> para una copia de alta calidad, o <strong>'PDF Original'</strong> si quieres probar la descarga directa.",
            footer: "v2.8.0 — Open Source"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "ID:",
            file: "Archivo:",
            pages: "Páginas:",
            analyzing: "Contando páginas...",
            activate: "Ir al modo de descarga",
            // Modo Escaneo 1: Alta Calidad (strip-stitch)
            hq_quality_btn: "Alta Calidad",
            hq_quality_sub: "Máxima nitidez",
            hq_quality_badge: "RECOMENDADO",
            hq_quality_tooltip: "Captura la página en máxima resolución y las une. Produce la imagen más nítida posible, aunque en algunas resoluciones de pantalla puede quedar un corte muy sutil entre franjas.",
            // Modo Escaneo 2: Sin Cortes (zoom-fit)
            hq_fit_btn: "Sin Cortes",
            hq_fit_sub: "Menos nitidez",
            hq_fit_badge: "COMPATIBLE",
            hq_fit_tooltip: "Hace zoom para que toda la página quepa en pantalla y toma una única foto. No hay cortes en ningún caso, aunque la imagen tiene algo menos de resolución que el modo Alta Calidad.",
            // Botón principal: escaneo HQ página a página
            hq_btn: "Escaneo Premium (Buena Calidad)",
            hq_badge: "RECOMENDADO",
            hq_tooltip: "Captura cada página como imagen de máxima resolución y genera un PDF completo. Tarda unos minutos pero garantiza resultados perfectos, incluso en documentos con restricciones de descarga.",
            // Sección con la opción alternativa
            adv_opts: "Opción alternativa",
            // Botón secundario: PDF original del servidor
            vec_btn: "Descargar PDF Original (Mejor Calidad)",
            vec_badge: "RÁPIDO",
            vec_tooltip: "Intenta obtener el PDF directamente del servidor externo. Mucho más rápido (segundos), aunque no siempre está disponible. Si falla, usa el Escaneo Premium de arriba.",
            // Aviso para documentos muy largos
            large_doc_warning: "⚠️ Documento extenso ({pages} páginas): el Escaneo Premium tardará bastante y creará varios archivos. Te recomendamos probar primero 'Descargar PDF Original'.",
            // Aviso al iniciar escaneo en doc grande
            hq_long_warning: "Escaneo iniciado. Puede tardar un buen rato — no cierres esta pestaña.",
            // Estados del botón durante el proceso
            states: {
                loading: "Preparando escaneo...",
                saving: "Generando PDF...",
                success: "¡PDF guardado correctamente!",
                error: "Algo salió mal: "
            },
            // Mensajes de error
            errors: {
                pdf_lib: "Recarga la página (F5) e intenta de nuevo.",
                no_pages: "No se encontraron páginas. ¿Estás viendo un documento de Scribd?",
                capture: "No se pudo capturar la pantalla. Revisa los permisos de la extensión."
            }
        },
        toast: {
            init: { title: "Iniciando", desc: "Conectando al servidor..." },
            verify: { title: "Verificación de Seguridad", desc: "Completando la protección Cloudflare automáticamente..." },
            // Cloudflare no pudo resolverse solo — pedimos ayuda manual al usuario
            verify_manual: {
                title: "Acción requerida",
                desc: "Cloudflare necesita tu ayuda. Completa el captcha en la página y la descarga seguirá sola.",
                help: "<b>¿Qué hago?</b><br/>Haz clic en el cuadro de verificación de Cloudflare que ves en la página. Una vez que lo completes, la extensión continuará automáticamente.<br/><br/>Si no aparece ningún cuadro, recarga la página e inténtalo de nuevo."
            },
            verify_done: { title: "Verificación Completada", desc: "Accediendo al documento..." },
            wait: { title: "Generando Enlace de Descarga", desc: "Esperando respuesta del servidor externo..." },
            // El servidor tardó demasiado en generar el enlace — no es un error crítico
            wait_timeout: {
                title: "El servidor está tardando",
                desc: "El servidor externo no generó el enlace a tiempo. Puedes cerrar esta pestaña e intentarlo de nuevo, o usar 'Escaneo HQ'.",
                help: "<b>¿Qué pasó?</b><br/>El servidor externo de descarga está ocupado o el documento no está disponible temporalmente.<br/><br/>👉 <b>Opciones:</b><br/>• Cierra esta pestaña y vuelve a pulsar 'PDF Original' en unos minutos.<br/>• Usa <b>'Escaneo HQ'</b> como alternativa segura."
            },
            redirect: { title: "Redirigiendo", desc: "Entrando a la fase final de descarga..." },
            analyzing: { title: "Analizando Documento", desc: "Localizando el archivo PDF..." },
            validating: { title: "Verificando Integridad", desc: "Comprobando tamaño y formato del archivo..." },
            success: { title: "¡Documento Validado!", desc: "La descarga ha comenzado. ¡Listo!" },
            error_detected: {
                title: "Documento No Disponible",
                desc: "El servidor indica que este documento no puede descargarse.",
                help: "<b>¿Qué pasó?</b><br/>El servidor externo no tiene disponible este documento en formato PDF original.<br/><br/>👉 <b>Solución:</b> Usa la opción <b>'Escaneo HQ'</b> para capturarlo página a página. Funciona en casi todos los documentos."
            },
            error_damaged: {
                title: "Archivo No Disponible",
                desc: "El PDF original está vacío o dañado.",
                help: "<b>Descarga Fallida:</b><br/>El archivo PDF original no está disponible o está dañado en el servidor externo.<br/><br/>👉 <b>Solución:</b> Cierra esta pestaña y usa la opción <b>'Escaneo HQ'</b> en el panel de la extensión. Este método alternativo funciona en casi todos los documentos."
            },
            error_timeout: { title: "Tiempo de Espera Agotado", desc: "El servidor externo tardó demasiado. Cierra esta pestaña e inténtalo de nuevo en unos minutos." }
        }
    },
    en: {
        popup: {
            title: "Scribd Premium",
            subtitle: "Document Downloader",
            status: "Ready to use",
            how_to: "HOW DOES IT WORK?",
            // Clear, jargon-free instructions
            step1: "Open any document on <strong>Scribd</strong> that you want to save (book, notes, presentation, etc.).",
            step2: "A <strong>floating panel</strong> will appear on screen. If you don't see it, reload the page with F5.",
            step3: "Click <strong>'Premium Scan'</strong> for a high-quality copy, or <strong>'Original PDF'</strong> to try a direct download.",
            footer: "v2.8.0 — Open Source"
        },
        overlay: {
            title: "⚡ Scribd Premium",
            id: "ID:",
            file: "File:",
            pages: "Pages:",
            analyzing: "Counting pages...",
            activate: "Go to download mode",
            // Scan Mode 1: High Quality (strip-stitch)
            hq_quality_btn: "High Quality",
            hq_quality_sub: "Maximum sharpness",
            hq_quality_badge: "RECOMMENDED",
            hq_quality_tooltip: "Captures the page in full-resolution strips and stitches them together. Produces the sharpest image possible, though on some screen resolutions a very subtle seam may appear between strips.",
            // Scan Mode 2: No Seams (zoom-fit)
            hq_fit_btn: "No Seams",
            hq_fit_sub: "Less sharpness",
            hq_fit_badge: "COMPATIBLE",
            hq_fit_tooltip: "Zooms out so the entire page fits on screen and takes a single screenshot. No seams in any case, though the image has slightly less resolution than High Quality mode.",
            // Main button: HQ page-by-page scan (used in large-doc banner)
            hq_btn: "Premium Scan (Good Quality)",
            hq_badge: "RECOMMENDED",
            hq_tooltip: "Captures each page as a full-resolution image and assembles the complete PDF. Takes a few minutes but delivers perfect results, even on documents with download restrictions.",
            // Alternative option section
            adv_opts: "Alternative option",
            // Secondary button: original PDF from server
            vec_btn: "Download Original PDF (Best Quality)",
            vec_badge: "FAST",
            vec_tooltip: "Tries to get the PDF directly from an external server. Much faster (seconds), though not always available. If it fails, use the Premium Scan above.",
            // Warning for very long documents
            large_doc_warning: "⚠️ Large document ({pages} pages): Premium Scan will take a while and create multiple files. We recommend trying 'Download Original PDF' first.",
            // Warning shown when starting scan on large doc
            hq_long_warning: "Scan started. This may take a while — please keep this tab open.",
            // Button states during the process
            states: {
                loading: "Preparing scan...",
                saving: "Generating PDF...",
                success: "PDF saved successfully!",
                error: "Something went wrong: "
            },
            // Error messages
            errors: {
                pdf_lib: "Reload the page (F5) and try again.",
                no_pages: "No pages found. Are you viewing a Scribd document?",
                capture: "Couldn't capture the screen. Check the extension permissions."
            }
        },
        toast: {
            init: { title: "Starting", desc: "Connecting to server..." },
            verify: { title: "Security Check", desc: "Completing Cloudflare protection automatically..." },
            // Cloudflare could not resolve automatically — asking user for manual help
            verify_manual: {
                title: "Action Required",
                desc: "Cloudflare needs your help. Complete the captcha on the page — the download will continue automatically.",
                help: "<b>What to do?</b><br/>Click the Cloudflare verification checkbox visible on the page. Once completed, the extension will continue automatically.<br/><br/>If no checkbox appears, reload the page and try again."
            },
            verify_done: { title: "Verification Complete", desc: "Accessing document..." },
            wait: { title: "Generating Download Link", desc: "Waiting for external server response..." },
            // Server took too long to generate the link — not a critical error
            wait_timeout: {
                title: "Server Is Taking Too Long",
                desc: "The external server didn't generate the link in time. You can close this tab and try again, or use 'Smart Scan (HQ)'.",
                help: "<b>What happened?</b><br/>The external download server is busy or the document is temporarily unavailable.<br/><br/>👉 <b>Options:</b><br/>• Close this tab and click 'Original PDF' again in a few minutes.<br/>• Use <b>'Smart Scan (HQ)'</b> as a reliable alternative."
            },
            redirect: { title: "Redirecting", desc: "Entering final download phase..." },
            analyzing: { title: "Analyzing Document", desc: "Locating PDF file..." },
            validating: { title: "Verifying Integrity", desc: "Checking file size and format..." },
            success: { title: "Document Ready!", desc: "Download has started. Enjoy!" },
            error_detected: {
                title: "Document Unavailable",
                desc: "The server indicates this document cannot be downloaded.",
                help: "<b>What happened?</b><br/>The external server does not have this document available as an original PDF.<br/><br/>👉 <b>Solution:</b> Use the <b>'Smart Scan (HQ)'</b> option to capture it page by page. Works on almost all documents."
            },
            error_damaged: {
                title: "File Unavailable",
                desc: "The original PDF is empty or corrupted.",
                help: "<b>Download Failed:</b><br/>The original PDF file is not available or is corrupted on the external server.<br/><br/>👉 <b>Solution:</b> Close this tab and use the <b>'Smart Scan (HQ)'</b> option in the extension panel. This alternative method works on almost all documents."
            },
            error_timeout: { title: "Request Timed Out", desc: "The external server took too long. Close this tab and try again in a few minutes." }
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
