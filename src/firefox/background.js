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
        return generateAndDownload(request.url, request.filename)
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

async function generateAndDownload(url, filename) {
    const scribdCookies = await getScribdCookies();

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
            body:   JSON.stringify(buildPayload(url, scribdCookies)),
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

function buildPayload(url, cookies) {
    return {
        source: url,
        cookies: cookies,
        http_headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Referer': 'https://www.scribd.com/'
        },
        wait_for_network: true
    };
}

async function getScribdCookies() {
    try {
        const cookies = await browser.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({
            name:   c.name,
            value:  c.value,
            domain: c.domain,
            path:   c.path   || '/',
            secure: c.secure || false
        }));
    } catch (err) {
        console.warn('[SDL BG] No se pudieron leer cookies de Scribd:', err.message);
        return [];
    }
}
