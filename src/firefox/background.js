/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 3.1.0 (Manifest V3 - Firefox)
 *
 * Misma lógica que Chrome pero usando browser.* (Promise-based).
 * Firefox no suspende el background script, pero mantenemos paridad.
 */

const PDFSHIFT_CONFIG = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey: 'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout: 90000
};

browser.runtime.onMessage.addListener((request, _sender) => {

    if (request.action === 'generate_pdf') {
        // El .catch() es obligatorio: sin él, un reject llega al content script
        // como respuesta vacía/undefined, imposible de depurar.
        return generateAndDownload(request.url, request.filename)
            .then(result => ({ success: true, ...result }))
            .catch(err   => ({ success: false, error: err.message || String(err) }));
    }

    if (request.action === 'trigger_download') {
        return browser.downloads.download({
            url:      request.url,
            filename: request.filename,
            saveAs:   true
        }).then(id  => ({ success: true, id }))
          .catch(err => ({ success: false, error: err.message }));
    }

    return Promise.resolve({ success: true });
});

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

    const pdfBlob = await response.blob();
    const objectUrl = URL.createObjectURL(pdfBlob);

    return browser.downloads.download({
        url: objectUrl,
        filename: `${filename}.pdf`,
        saveAs: true
    }).then(id => ({ success: true, downloadId: id }));
}
