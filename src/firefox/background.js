/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 3.2.0 (Manifest V3 - Firefox)
 */

const PDFSHIFT_CONFIG = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  90000
};

// ─── Listener de mensajes ─────────────────────────────────────────────────
browser.runtime.onMessage.addListener((request, _sender) => {

    if (request.action === 'generate_pdf') {
        return generateAndDownload(request)
            .then(result => ({ success: true,  ...result }))
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

// ─── Generación + descarga ────────────────────────────────────────────────

async function generateAndDownload(request) {
    const { html, url, filename } = request;

    const source     = html || url;
    const isHtml     = !!html;
    const cookies    = isHtml ? [] : await getScribdCookies();

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
            body:   JSON.stringify(buildPayload(source, cookies, isHtml)),
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

    return browser.downloads.download({
        url:      objectUrl,
        filename: `${filename}.pdf`,
        saveAs:   true
    }).then(id => ({ success: true, downloadId: id }));
}

function buildPayload(source, cookies, isHtml) {
    const payload = { source, format: 'A4' };
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

async function getScribdCookies() {
    try {
        const cookies = await browser.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));

    } catch (err) {
        console.warn('[SDL BG] No se pudieron leer cookies de Scribd:', err.message);
        return [];
    }
}
