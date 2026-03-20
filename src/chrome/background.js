/**
 * Scribd Premium Downloader - Background Service Worker
 * @version 3.0.0 (Manifest V3)
 *
 * Actúa como puente seguro entre el content script y chrome.downloads.
 * chrome.downloads no está disponible en content scripts, por eso
 * el content script delega aquí la descarga nativa.
 */

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {

    // Único action soportado: iniciar una descarga con el gestor nativo del navegador
    if (request.action === 'trigger_download') {
        chrome.downloads.download({
            url:    request.url,
            filename: request.filename,
            saveAs: true // Permite al usuario elegir la carpeta de destino
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('[SDL BG] Error en descarga:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, id: downloadId });
            }
        });

        // Retornar true mantiene el canal de mensaje abierto para la respuesta asíncrona
        return true;
    }

    // Respuesta por defecto para mensajes desconocidos
    sendResponse({ success: true });
});

/**
 * Puerto de keepalive para evitar que el Service Worker se suspenda
 * durante operaciones largas (Chrome suspende SWs inactivos ~30s).
 * El content script puede abrir este puerto para mantener el SW activo.
 */
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sdl-keepalive') {
        port.onDisconnect.addListener(() => {
            // El puerto se desconecta al terminar la operación, no se necesita lógica aquí
        });
    }
});
