/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 3.4.0 (Manifest V3 - Firefox)
 */

const PDFSHIFT = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  90_000
};

const SCRIBD_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.5',
    'Cache-Control':   'no-cache'
};

// ─── Listener de mensajes ─────────────────────────────────────────────────
browser.runtime.onMessage.addListener((request, _sender) => {

    if (request.action === 'generate_pdf') {
        return generateAndDownload(request)
            .then(result => ({ success: true,  ...result }))
            .catch(err   => ({ success: false, error: err.message || String(err) }));
    }

    return Promise.resolve({ success: true });
});

// ─── Orquestador ──────────────────────────────────────────────────────────
async function generateAndDownload({ html: domHtml, url, filename }) {
    const docId = extractDocId(url);

    // Estrategia 1: fetch directo a Scribd con cookies del usuario
    if (docId) {
        try {
            const embedHtml = await fetchScribdEmbed(docId);
            if (embedHtml) {
                console.debug('[SDL BG] Estrategia 1 OK: embed obtenido de Scribd');
                const objectUrl = await convertHtmlToPdf(embedHtml);
                return browser.downloads.download({
                    url:      objectUrl,
                    filename: `${filename}.pdf`,
                    saveAs:   true
                }).then(id => ({ downloadId: id }));
            }
        } catch (err) {
            console.warn('[SDL BG] Estrategia 1 falló:', err.message);
        }
    }

    // Estrategia 2: HTML capturado del DOM
    if (domHtml) {
        console.debug('[SDL BG] Estrategia 2: HTML del DOM');
        const objectUrl = await convertHtmlToPdf(domHtml);
        return browser.downloads.download({
            url:      objectUrl,
            filename: `${filename}.pdf`,
            saveAs:   true
        }).then(id => ({ downloadId: id }));
    }

    throw new Error(
        'No se pudo obtener el contenido. ' +
        'Asegúrate de que el documento esté cargado y vuelve a intentar.'
    );
}

// ─── Fetch autenticado a Scribd ───────────────────────────────────────────
async function fetchScribdEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const authHeaders = { ...SCRIBD_HEADERS, Cookie: cookieStr };

    const pageUrl = `https://www.scribd.com/document/${docId}`;
    const pageRes = await fetch(pageUrl, { headers: authHeaders, redirect: 'follow' });

    if (!pageRes.ok) throw new Error(`Scribd página ${pageRes.status}`);

    const pageHtml  = await pageRes.text();
    const accessKey = extractAccessKey(pageHtml);

    if (!accessKey) {
        console.warn('[SDL BG] access_key no encontrado en el HTML de Scribd');
        return null;
    }

    console.debug('[SDL BG] access_key encontrado:', accessKey.substring(0, 10) + '...');

    const embedUrl = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll`,
        `&access_key=${encodeURIComponent(accessKey)}`
    ].join('');

    const embedRes = await fetch(embedUrl, {
        headers:  { ...authHeaders, Referer: pageUrl },
        redirect: 'follow'
    });

    if (!embedRes.ok) throw new Error(`Scribd embed ${embedRes.status}`);

    const rawHtml = await embedRes.text();
    return wrapEmbedHtml(rawHtml);
}

function extractAccessKey(html) {
    const patterns = [
        /"access_key"\s*:\s*"([a-zA-Z0-9_\-]{10,})"/,
        /access_key['":\s]+['"]([a-zA-Z0-9_\-]{10,})['"]/,
        /data-access-key="([a-zA-Z0-9_\-]{10,})"/
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
    }
    return null;
}

function wrapEmbedHtml(html) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: white; color: black; font-family: Georgia, serif; }
    [class*="page"], .outer_page { page-break-after: always; background: white; }
    img { max-width: 100%; height: auto; }
    .toolbar_container, .toolbar, nav, [class*="toolbar"] { display: none !important; }
</style></head><body>${html}</body></html>`;
}

async function convertHtmlToPdf(htmlContent) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    let response;
    try {
        response = await fetch(PDFSHIFT.endpoint, {
            method:  'POST',
            headers: { 'X-API-Key': PDFSHIFT.apiKey, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ source: htmlContent, format: 'A4' }),
            signal:  controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`PDFShift ${response.status}: ${errText}`);
    }

    return URL.createObjectURL(await response.blob());
}

function extractDocId(url) {
    return url?.match(/\/(?:document|doc|embeds|read|book)\/(\d+)/)?.[1] ?? null;
}

async function getScribdCookies() {
    try {
        const cookies = await browser.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));
    } catch (err) {
        console.warn('[SDL BG] Cookies no disponibles:', err.message);
        return [];
    }
}
