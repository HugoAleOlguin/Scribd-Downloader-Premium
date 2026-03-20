/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 3.5.0 (Manifest V3 - Firefox)
 *
 * ESTRATEGIAS (en orden):
 *  1. Usar el access_key que encontró el content script → fetch embed directo (sin cookies)
 *  2. Background busca el access_key en el HTML de la página de Scribd (con cookies)
 *  3. Usar el HTML capturado del DOM por content.js
 */

const PDFSHIFT = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  90_000
};

const SCRIBD_UNIVERSAL_KEY = 'key-fFexxf7r1bzEfWu3HKwf';

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
async function generateAndDownload({ html: domHtml, url, accessKey, filename }) {
    const docId = extractDocId(url);
    console.log('[SDL BG] Iniciando. docId:', docId, '| html:', !!domHtml, '| ak:', !!accessKey);

    // ── Estrategia 0: embed HTML + CSS inlineado desde scribdassets.com ────────
    if (docId) {
        try {
            console.log('[SDL BG] Estrategia 0: embed HTML + CSS + imágenes inlineados...');
            const cookies = await getScribdCookies();
            const rawHtml  = await fetchRawEmbed(docId);
            const stripped = stripGdprScripts(rawHtml);
            const withCSS  = await inlineExternalCSS(stripped);
            const withImgs = await inlinePageImages(withCSS, cookies);
            const prepared = prepareEmbedHtml(withImgs);
            const objectUrl = await convertHtmlToPdf(prepared);
            console.log('[SDL BG] Estrategia 0 OK');
            return browser.downloads.download({ url: objectUrl, filename: `${filename}.pdf`, saveAs: true })
                .then(id => ({ downloadId: id }));
        } catch (err) {
            console.log('[SDL BG] Estrategia 0 falló:', err.message);
        }
    }

    if (docId) {
        try {
            const directUrl = await tryScribdDirectDownload(docId);
            if (directUrl) {
                console.log('[SDL BG] Estrategia 0 OK: PDF directo de Scribd');
                return browser.downloads.download({ url: directUrl, filename: `${filename}.pdf`, saveAs: true })
                    .then(id => ({ downloadId: id }));
            }
        } catch (err) {
            console.log('[SDL BG] Estrategia 0 falló:', err.message);
        }
    }

    // Estrategia 1: HTML del body capturado por content.js
    if (domHtml) {
        try {
            console.log('[SDL BG] Estrategia 1: convirtiendo HTML del DOM a PDF...');
            const objectUrl = await convertHtmlToPdf(domHtml);
            return browser.downloads.download({ url: objectUrl, filename: `${filename}.pdf`, saveAs: true })
                .then(id => ({ downloadId: id }));
        } catch (err) {
            console.log('[SDL BG] Estrategia 1 falló:', err.message);
        }
    }

    throw new Error(
        domHtml
            ? 'El servidor PDF rechazó el contenido.'
            : 'No se pudo obtener el documento. Verifica permisos de descarga en tu cuenta Scribd.'
    );
}

async function tryScribdDirectDownload(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await fetch(
        `https://www.scribd.com/document_downloads/download/${docId}?extension=pdf`,
        { method: 'GET', headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }, redirect: 'follow' }
    );

    const contentType = response.headers.get('content-type') || '';
    console.log('[SDL BG] Scribd download status:', response.status, '| type:', contentType.substring(0, 40));

    if (response.ok && (contentType.includes('pdf') || contentType.includes('octet-stream'))) {
        return URL.createObjectURL(await response.blob());
    }
    return null;
}



// ─── Estrategia 1: embed directo con access_key ───────────────────────────

/**
 * Fetchea el embed de Scribd usando el access_key como token de autorización.
 * No requiere cookies del usuario: el access_key fue diseñado para acceso externo.
 */
async function fetchEmbedWithKey(docId, accessKey) {
    const embedUrl = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll`,
        `&access_key=${encodeURIComponent(accessKey)}`
    ].join('');

    const res = await fetch(embedUrl, { headers: { ...SCRIBD_HEADERS } });

    if (!res.ok) throw new Error(`Scribd embed ${res.status}`);
    return wrapEmbedHtml(await res.text());
}

// ─── Estrategia 2: fetch autenticado a Scribd ────────────────────────────

async function fetchScribdEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const authHeaders = { ...SCRIBD_HEADERS, Cookie: cookieStr };

    const pageUrl = `https://www.scribd.com/document/${docId}`;
    console.log('[SDL BG] Fetching Scribd page:', pageUrl);

    const pageRes = await fetch(pageUrl, { headers: authHeaders, redirect: 'follow' });
    console.log('[SDL BG] Scribd page status:', pageRes.status);

    if (!pageRes.ok) throw new Error(`Scribd página ${pageRes.status}`);

    const pageHtml  = await pageRes.text();
    console.log('[SDL BG] HTML length:', pageHtml.length);

    const accessKey = extractAccessKey(pageHtml);
    console.log('[SDL BG] access_key en respuesta:', accessKey ? `sí (${accessKey.substring(0, 10)}...)` : 'NO');

    if (!accessKey) return null;

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
    return prepareEmbedHtml(stripScripts(await embedRes.text()));
}

function extractAccessKey(html) {
    const patterns = [
        /"access_key"\s*:\s*"([a-zA-Z0-9_\-]{10,})"/,
        /'access_key'\s*:\s*'([a-zA-Z0-9_\-]{10,})'/,
        /data-access-key="([a-zA-Z0-9_\-]{10,})"/
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
    }
    return null;
}

function stripGdprScripts(html) {
    return html
        .replace(/<script\b[^>]*src=["'][^"']*osano[^"']*["'][^>]*(?:><\/script>|\/?>) */gi, '')
        .replace(/<script\b[^>]*src=["'][^"']*(?:segment\.com|googletagmanager|sentry\.io|clarity\.ms|stripe\.com|js\.stripe)[^"']*["'][^>]*(?:><\/script>|\/?>) */gi, '')
        .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
}

function prepareEmbedHtml(html) {
    const overrideCSS = `<style id="sdl-overrides">
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
[class*="toolbar_container"], [class*="DocControls"],
#autosave_dialog, .grecaptcha-badge { display: none !important; }
[class*="osano"], [id*="osano"], [class*="consent"], [id*="consent"],
[class*="cookie"], [id*="cookie"], [class*="gdpr"], [id*="gdpr"],
[role="dialog"][aria-modal="true"], .sp-message-container { display: none !important; }
</style>`;
    if (html.includes('</head>')) {
        return html.replace('</head>', overrideCSS + '\n</head>');
    }
    return overrideCSS + html;
}

async function fetchRawEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const url = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll&access_key=${SCRIBD_UNIVERSAL_KEY}`,
        `&show_recommendations=false`
    ].join('');
    const res = await fetch(url, { headers: { ...SCRIBD_HEADERS, Cookie: cookieStr } });
    if (!res.ok) throw new Error(`Embed ${res.status}`);
    const html = await res.text();
    if (html.length < 5_000) throw new Error('Embed HTML muy corto');
    return html;
}

async function inlineExternalCSS(html) {
    const hrefRe  = /\bhref=["']([^"']+)["']/i;
    const linkTags = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\/?>/gi)].map(m => m[0]);
    if (!linkTags.length) return html;
    console.log('[SDL BG] CSS inline: fetching', linkTags.length, 'archivos CSS...');

    const jobs = linkTags.map(async (tag) => {
        const hrefM = tag.match(hrefRe);
        if (!hrefM) return { tag, css: null };
        let url = hrefM[1];
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.startsWith('http')) return { tag, css: null };
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12_000);
            const res = await fetch(url, {
                headers: { Accept: 'text/css,*/*', 'User-Agent': SCRIBD_HEADERS['User-Agent'] },
                signal: controller.signal
            });
            clearTimeout(timer);
            return { tag, css: res.ok ? await res.text() : null };
        } catch { return { tag, css: null }; }
    });

    const results = await Promise.allSettled(jobs);
    let result = html;
    let count = 0;
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value.css) {
            result = result.replace(r.value.tag, `<style>\n${r.value.css}\n</style>`);
            count++;
        }
    }
    console.log('[SDL BG] CSS inline:', count, '/', linkTags.length, 'inlineados');
    return result;
}

async function inlinePageImages(html, cookies = []) {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const imgRe = /(<img\b[^>]*\bsrc=")([^"]+)("[^>]*>)/gi;
    const allSrcs = [];
    let m;
    while ((m = imgRe.exec(html)) !== null) allSrcs.push(m[2]);
    if (!allSrcs.length) return html;
    console.log('[SDL BG] Imágenes inline: descargando', allSrcs.length, 'imágenes...');

    const cache = new Map();
    await Promise.allSettled(
        allSrcs.map(async (src) => {
            if (cache.has(src)) return;
            let url = src;
            if (url.startsWith('//')) url = 'https:' + url;
            if (!url.startsWith('http')) { cache.set(src, null); return; }
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 15_000);
                const res = await fetch(url, {
                    headers: { ...SCRIBD_HEADERS, Cookie: cookieStr, Referer: 'https://www.scribd.com/' },
                    signal: controller.signal
                });
                clearTimeout(timer);
                if (!res.ok) { cache.set(src, null); return; }
                const buffer = await res.arrayBuffer();
                const mime = res.headers.get('content-type') || 'image/jpeg';
                const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                cache.set(src, `data:${mime};base64,${b64}`);
            } catch { cache.set(src, null); }
        })
    );

    let count = 0;
    const result = html.replace(imgRe, (match, pre, src, post) => {
        const d = cache.get(src);
        if (!d) return match;
        count++;
        return pre + d + post;
    });
    console.log('[SDL BG] Imágenes inline:', count, '/', allSrcs.length);
    return result;
}

// ─── PDFShift ─────────────────────────────────────────────────────────────
async function convertHtmlToPdf(htmlContent) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    let response;
    try {
        const payload = {
            source:   htmlContent,
            format:   'A4',
            delay:    6000,
            zoom:     0.75,
            margin:   '0',
        };
        response = await fetch(PDFSHIFT.endpoint, {
            method:  'POST',
            headers: { 'X-API-Key': PDFSHIFT.apiKey, 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
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

// ─── Utilidades ───────────────────────────────────────────────────────────
function extractDocId(url) {
    return url?.match(/\/(?:document|doc|embeds|read|book)\/(\d+)/)?.[1] ?? null;
}

async function getScribdCookies() {
    try {
        const cookies = await browser.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));
    } catch (err) {
        console.log('[SDL BG] Cookies no disponibles:', err.message);
        return [];
    }
}
