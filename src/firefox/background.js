/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 3.0.0 (Manifest V3 / Firefox MV3)
 *
 * Actúa como puente seguro entre el content script y browser.downloads.
 * browser.downloads no está disponible en content scripts, por eso
 * el content script delega aquí la descarga nativa.
 *
 * Firefox MV3 usa `browser.*` (con polyfill) y background "scripts" en lugar de service_worker.
 */

browser.runtime.onMessage.addListener((request, _sender) => {

    if (request.action === 'trigger_download') {
        // browser.downloads.download devuelve una Promise en Firefox
        return browser.downloads.download({
            url:      request.url,
            filename: request.filename,
            saveAs:   true
        }).then(downloadId => {
            return { success: true, id: downloadId };
        }).catch(error => {
            console.error('[SDL BG Firefox] Error en descarga:', error.message);
            return { success: false, error: error.message };
        });
    }

    return Promise.resolve({ success: true });
});
