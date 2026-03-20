/**
 * Scribd Premium Downloader - Background Service Worker
 * @version 3.2.0 (Manifest V3)
 *
 * Fetch a la API de PDFShift con cookies de sesión de Scribd.
 * Las cookies son necesarias porque PDFShift visita la URL desde sus
 * propios servidores: sin autenticación, Scribd devuelve un error HTTP.
 */

const PDFSHIFT_CONFIG = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  90000
};

// ─── Listener de mensajes ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {

    if (request.action === 'generate_pdf') {
        generateAndDownload(request)
            .then(result => sendResponse({ success: true,  ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === 'trigger_download') {
        triggerDownload(request.url, request.filename)
            .then(id  => sendResponse({ success: true,  id }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    sendResponse({ success: true });
});

// ─── Generación + descarga ────────────────────────────────────────────────

/**
 * Modo HTML:  content.js capturó el DOM y lo manda como string.
 *             PDFShift renderiza ese HTML localmente → sin acceso a Scribd.
 * Modo URL:   fallback si llega una url en vez de html.
 */
async function generateAndDownload(request) {
    const { html, url, filename } = request;

    // Preferir HTML capturado del DOM — no requiere cookies ni acceso a Scribd
    const source = html || url;
    const needsCookies = !html;

    const cookies = needsCookies ? await getScribdCookies() : [];

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT_CONFIG.timeout);

    let response;
    try {
        response = await fetch(PDFSHIFT_CONFIG.endpoint, {
            method:  'POST',
            headers: {
                'X-API-Key':    PDFSHIFT_CONFIG.apiKey,
                'Content-Type': 'application/json'
            },
            body:   JSON.stringify(buildPayload(source, cookies, !!html)),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`PDFShift Error ${response.status}: ${errText}`);
    }

    const pdfBlob   = await response.blob();
    const objectUrl = URL.createObjectURL(pdfBlob);
    const downloadId = await triggerDownload(objectUrl, `${filename}.pdf`);

    return { downloadId };
}

/**
 * Construye el payload para PDFShift.
 * isHtml=true: PDFShift recibe contenido HTML ya extraído del DOM.
 *              No necesita cookies ni headers de Scribd.
 * isHtml=false: PDFShift visita una URL externa (fallback).
 */
function buildPayload(source, cookies, isHtml) {
    const payload = {
        source,
        format: 'A4'
    };

    if (!isHtml) {
        payload.cookies = cookies;
        payload.http_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Referer': 'https://www.scribd.com/'
        };
        payload.wait_for_network = true;
    }

    return payload;
}

/**
 * Lee las cookies de scribd.com desde el gestor de cookies del navegador.
 * Las convierte al formato que espera PDFShift: [{ name, value, domain }].
 */
async function getScribdCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));

    } catch (err) {
        console.warn('[SDL BG] No se pudieron leer cookies de Scribd:', err.message);
        return [];
    }
}

/**
 * Inicia una descarga nativa con chrome.downloads (promisificado).
 */
function triggerDownload(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({ url, filename, saveAs: true }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(downloadId);
            }
        });
    });
}

// ─── Keepalive ────────────────────────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sdl-keepalive') return;
    const interval = setInterval(() => {
        try { port.postMessage('ping'); } catch { clearInterval(interval); }
    }, 20000);
    port.onDisconnect.addListener(() => clearInterval(interval));
});
