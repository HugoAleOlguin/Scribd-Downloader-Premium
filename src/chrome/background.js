/**
 * Scribd Premium Downloader - Background Service Worker
 * @version 3.1.0 (Manifest V3)
 *
 * El background script es el único lugar donde se pueden hacer fetches
 * a APIs externas sin restricciones CORS en una extensión MV3.
 *
 * Flujo:
 *   content.js  →  { action: 'generate_pdf', url, filename }
 *       ↓
 *   background.js  →  fetch a PDFShift API
 *       ↓
 *   chrome.downloads.download({ url: blobUrl, filename })
 */

// =============================================================================
// CONFIGURACIÓN DE LA API
// =============================================================================
// Servicio: PDFShift  →  https://app.pdfshift.io
// Plan gratuito: 50 conversiones/mes, sin tarjeta de crédito.
// Crea tu cuenta y obtén tu API key en: https://app.pdfshift.io/dashboard/
//
// IMPORTANTE: Reemplaza 'TU_API_KEY_AQUI' con tu key real antes de compilar.
// =============================================================================
const PDFSHIFT_CONFIG = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey: 'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout: 90000
};

// =============================================================================
// LISTENER DE MENSAJES
// =============================================================================
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {

    if (request.action === 'generate_pdf') {
        generateAndDownload(request.url, request.filename)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));

        // Retorna true para mantener el canal de mensaje abierto (respuesta asíncrona)
        return true;
    }

    if (request.action === 'trigger_download') {
        triggerDownload(request.url, request.filename)
            .then(id => sendResponse({ success: true, id }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    sendResponse({ success: true });
});

// =============================================================================
// FUNCIONES PRINCIPALES
// =============================================================================

/**
 * Llama a PDFShift, obtiene el PDF y lo descarga usando chrome.downloads.
 * Todo ocurre aquí en el SW: sin CORS, sin restricciones de origen.
 */
async function generateAndDownload(url, filename) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDFSHIFT_CONFIG.timeout);

    let response;
    try {
        response = await fetch(PDFSHIFT_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'X-API-Key': PDFSHIFT_CONFIG.apiKey,
                'Content-Type': 'application/json'
            },
            // sandbox:true → no consume créditos, incluye watermark (útil para pruebas)
            // Eliminar sandbox cuando estés listo para producción
            body: JSON.stringify({ source: url }),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`PDFShift Error ${response.status}: ${errText}`);
    }

    // PDFShift devuelve el binario del PDF directamente
    const pdfBlob = await response.blob();
    const objectUrl = URL.createObjectURL(pdfBlob);

    const downloadId = await triggerDownload(objectUrl, `${filename}.pdf`);
    return { downloadId };
}

/**
 * Inicia una descarga nativa con chrome.downloads.
 * Promisifica el callback para integrarse con async/await.
 */
function triggerDownload(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url,
            filename,
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(downloadId);
            }
        });
    });
}

// =============================================================================
// KEEPALIVE
// =============================================================================
// Chrome suspende el Service Worker ~30s tras quedar inactivo.
// El content script puede conectarse a este puerto durante operaciones largas.
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sdl-keepalive') return;
    const interval = setInterval(() => port.postMessage('ping'), 20000);
    port.onDisconnect.addListener(() => clearInterval(interval));
});
