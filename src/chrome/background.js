/**
 * Scribd Premium Downloader - Background Service Worker
 * @version 3.4.0 (Manifest V3)
 *
 * ESTRATEGIA (en orden de preferencia):
 *
 *  1. El background fetchea scribd.com CON las cookies del usuario
 *     (usando el header Cookie manual — las extensiones con host_permissions
 *     pueden hacerlo sin restricciones CORS).
 *     → Obtiene el access_key del HTML del servidor.
 *     → Fetchea el embed URL con ese access_key.
 *     → Envía el HTML del embed a PDFShift. PDFShift nunca accede a Scribd.
 *
 *  2. Si falla (access_key no encontrado o embed error):
 *     → Usa el HTML capturado del DOM por content.js (si llegó uno).
 *     → Envía ese HTML a PDFShift.
 *
 *  3. Error claro con la razón.
 */

const PDFSHIFT = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  90_000
};

// Key universal de Scribd — compartida por todos los sitios de descarga (pdfdownloader.net, etc.)
// Permite acceder al embed de CUALQUIER documento sin cuenta ni suscripción.
const SCRIBD_UNIVERSAL_KEY = 'key-fFexxf7r1bzEfWu3HKwf';

const SCRIBD_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.5',
    'Cache-Control':   'no-cache'
};

// ─── Listener de mensajes ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {

    if (request.action === 'generate_pdf') {
        generateAndDownload(request)
            .then(result => sendResponse({ success: true,  ...result }))
            .catch(err   => sendResponse({ success: false, error: err.message }));
        return true;
    }

    sendResponse({ success: true });
});

// ─── Orquestador principal ────────────────────────────────────────────────
async function generateAndDownload({ html: domHtml, url, accessKey, printMode, filename }) {
    const docId = extractDocId(url);
    console.log('[SDL BG] Iniciando. docId:', docId, '| html:', !!domHtml, '| ak:', !!accessKey);

    // ── Estrategia 0: embed HTML + CSS inlineado desde scribdassets.com ────────
    // PDFShift NO puede acceder a Scribd (IP bloqueada). Nosotros sí.
    // Solución: fetchear el HTML del embed + sus CSS en el background,
    // inlinearlos, y enviar un HTML autocontenido sin dependencias externas.
    if (docId) {
        try {
            console.log('[SDL BG] Estrategia 0: embed HTML + CSS + imágenes inlineados...');
            const cookies = await getScribdCookies();
            const rawHtml  = await fetchRawEmbed(docId);
            const stripped = stripGdprScripts(rawHtml);
            const withCSS  = await inlineExternalCSS(stripped);
            const withImgs = await inlinePageImages(withCSS, cookies);
            const prepared = prepareEmbedHtml(withImgs);
            const objectUrl = await convertHtmlToPdf(prepared, false);
            console.log('[SDL BG] Estrategia 0 OK');
            return triggerDownload(objectUrl, `${filename}.pdf`);
        } catch (err) {
            console.log('[SDL BG] Estrategia 0 falló:', err.message);
        }
    }

    // ── Estrategia A: access_key específico del content script (embeds externos) ─
    if (docId && accessKey) {
        try {
            console.log('[SDL BG] Estrategia A: embed con access_key...');
            const embedHtml = await fetchEmbedWithKey(docId, accessKey);
            const objectUrl = await convertHtmlToPdf(embedHtml, false);
            return triggerDownload(objectUrl, `${filename}.pdf`);
        } catch (err) {
            console.log('[SDL BG] Estrategia A falló:', err.message);
        }
    }

    // ── Estrategia B: embed URL con cookies de sesión del usuario ──────────
    // Si el usuario tiene acceso (por uploads, suscripción, o doc público),
    // el embed URL sirve el documento limpio SIN el UI de Scribd.
    if (docId) {
        try {
            console.log('[SDL BG] Estrategia B: embed URL con cookies...');
            const embedHtml = await tryEmbedWithCookies(docId);
            if (embedHtml) {
                console.log('[SDL BG] Estrategia B OK: embed obtenido');
                const objectUrl = await convertHtmlToPdf(embedHtml, false);
                return triggerDownload(objectUrl, `${filename}.pdf`);
            }
        } catch (err) {
            console.log('[SDL BG] Estrategia B falló:', err.message);
        }
    }

    // ── Estrategia C: descarga directa de Scribd (suscriptores) ─────────────
    if (docId) {
        try {
            const directUrl = await tryScribdDirectDownload(docId);
            if (directUrl) {
                console.log('[SDL BG] Estrategia C OK: PDF directo de Scribd');
                return triggerDownload(directUrl, `${filename}.pdf`);
            }
        } catch (err) {
            console.log('[SDL BG] Estrategia C falló:', err.message);
        }
    }

    // ── Estrategia D: HTML del body capturado por content.js ────────────
    if (domHtml) {
        try {
            console.log('[SDL BG] Estrategia D: HTML del DOM a PDF (printMode:', printMode, ')...');
            const objectUrl = await convertHtmlToPdf(domHtml, printMode);
            return triggerDownload(objectUrl, `${filename}.pdf`);
        } catch (err) {
            console.log('[SDL BG] Estrategia D falló:', err.message);
        }
    }

    throw new Error(
        domHtml
            ? 'El servidor PDF rechazó el contenido capturado.'
            : 'No se pudo obtener el contenido. La cuenta de Scribd no tiene permisos de descarga o el documento no está disponible.'
    );
}

/**
 * Estrategia B: fetchea el embed de Scribd con las cookies de sesión del usuario.
 * El embed URL sirve el documento limpio (sin UI de Scribd) si el usuario tiene acceso.
 * No requiere access_key.
 */
async function tryEmbedWithCookies(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&show_recommendations=false`;

    const res = await fetch(embedUrl, {
        headers:  { ...SCRIBD_HEADERS, Cookie: cookieStr },
        redirect: 'follow'
    });

    const contentType = res.headers.get('content-type') || '';
    console.log('[SDL BG] Embed URL status:', res.status, '| type:', contentType.substring(0, 30));

    if (!res.ok || !contentType.includes('text/html')) return null;

    const html = await res.text();

    // Verificar que la respuesta contiene contenido real (no página de error/login)
    const hasContent = html.length > 5_000
        && !html.toLowerCase().includes('"error"')
        && !html.includes('login_modal')
        && !html.includes('signup');

    if (!hasContent) {
        console.log('[SDL BG] Embed URL devolvió error o paywall (', html.length, 'chars)');
        return null;
    }

    return prepareEmbedHtml(html);
}


// ─── Estrategia 0: descarga directa de Scribd ────────────────────────
async function tryScribdDirectDownload(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await fetch(
        `https://www.scribd.com/document_downloads/download/${docId}?extension=pdf`,
        {
            method:   'GET',
            headers:  { ...SCRIBD_HEADERS, Cookie: cookieStr },
            redirect: 'follow'
        }
    );

    const contentType = response.headers.get('content-type') || '';
    console.log('[SDL BG] Scribd download status:', response.status, '| type:', contentType.substring(0, 40));

    if (response.ok && (contentType.includes('pdf') || contentType.includes('octet-stream'))) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    return null;  // No disponible (no suscriptor, o formato no reconocido)
}


/**
 * Fetchea el HTML crudo del embed de Scribd usando el key universal + cookies.
 */
async function fetchRawEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll&access_key=${SCRIBD_UNIVERSAL_KEY}`,
        `&show_recommendations=false`
    ].join('');

    const res = await fetch(url, {
        headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }
    });

    if (!res.ok) throw new Error(`Embed ${res.status}`);
    const html = await res.text();
    if (html.length < 5_000) throw new Error('Embed HTML muy corto (' + html.length + ' chars)');
    return html;
}

/**
 * Reemplaza todos los <link rel="stylesheet"> del HTML por <style> inline.
 * El background script sí puede acceder a scribdassets.com; PDFShift no puede.
 * El resultado es un HTML autocontenido sin dependencias externas de CSS.
 */
async function inlineExternalCSS(html) {
    const linkRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\/?>/gi;
    const hrefRe = /\bhref=["']([^"']+)["']/i;

    const linkTags = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\/?>/gi)]
        .map(m => m[0]);

    if (!linkTags.length) {
        console.log('[SDL BG] CSS inline: no se encontraron <link> stylesheet');
        return html;
    }
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
            const css = res.ok ? await res.text() : null;
            return { tag, css };
        } catch {
            return { tag, css: null };
        }
    });

    const results = await Promise.allSettled(jobs);

    let result = html;
    let inlinedCount = 0;
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value.css) {
            result = result.replace(r.value.tag, `<style>\n${r.value.css}\n</style>`);
            inlinedCount++;
        }
    }
    console.log('[SDL BG] CSS inline:', inlinedCount, '/', linkTags.length, 'inlineados');
    return result;
}

/**
 * Descarga las imágenes de página (img.absimg) y las convierte a data URIs base64.
 *
 * Scribd usa un sistema de renderizado híbrido:
 * - image_layer: JPEG de la página completa (contiene bordes de tabla, fondos, gráficos).
 * - text_layer: spans posicionados sobre la imagen (solo texto, sin visual).
 *
 * PDFShift no puede acceder a html.scribdassets.com (bloqueado por Scribd).
 * El background sí puede, porque corre en el contexto del navegador del usuario.
 * Al convertir a base64, el HTML queda 100% autocontenido.
 */
async function inlinePageImages(html, cookies = []) {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Encuentra todas las URL de imágenes en src="..."
    const imgRe  = /(<img\b[^>]*\bsrc=")([^"]+)("[^>]*>)/gi;
    const allSrcs = [];
    let m;
    while ((m = imgRe.exec(html)) !== null) {
        allSrcs.push(m[2]);
    }

    if (!allSrcs.length) {
        console.log('[SDL BG] Imágenes inline: no se encontraron <img>');
        return html;
    }
    console.log('[SDL BG] Imágenes inline: descargando', allSrcs.length, 'imágenes...');

    // Descargar todas las imágenes concurrentemente
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
                    headers: {
                        ...SCRIBD_HEADERS,
                        Cookie: cookieStr,
                        Referer: 'https://www.scribd.com/'
                    },
                    signal: controller.signal
                });
                clearTimeout(timer);
                if (!res.ok) { cache.set(src, null); return; }

                const buffer = await res.arrayBuffer();
                const mime   = res.headers.get('content-type') || 'image/jpeg';
                const b64    = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                cache.set(src, `data:${mime};base64,${b64}`);
            } catch {
                cache.set(src, null);
            }
        })
    );

    let inlinedCount = 0;
    const result = html.replace(imgRe, (match, pre, src, post) => {
        const dataUri = cache.get(src);
        if (!dataUri) return match;  // mantener original si falló la descarga
        inlinedCount++;
        return pre + dataUri + post;
    });

    console.log('[SDL BG] Imágenes inline:', inlinedCount, '/', allSrcs.length, 'descargadas');
    return result;
}

/**
 * Fetchea el embed usando un access_key ya conocido (para páginas externas).
 */
async function fetchEmbedWithKey(docId, accessKey, withCookies = false) {
    const embedUrl = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll&show_recommendations=false`,
        `&access_key=${encodeURIComponent(accessKey)}`
    ].join('');

    const headers = { ...SCRIBD_HEADERS };
    if (withCookies) {
        const cookies   = await getScribdCookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        if (cookieStr) headers.Cookie = cookieStr;
    }

    const res = await fetch(embedUrl, { headers });
    if (!res.ok) throw new Error(`Scribd embed ${res.status}`);

    const html = await res.text();
    return prepareEmbedHtml(stripScripts(html));
}

/**
 * Elimina SOLO scripts de GDPR/tracking externos (Osano, analytics).
 * Mantiene los bundles de Scribd (DocumentManager, React) para que
 * PDFShift pueda ejecutarlos y renderizar bordes/tablas correctamente.
 * DocumentManager crea los elementos visuales (bordes, lineas) en runtime;
 * sin el, el document renderiza solo texto sin estructura visual.
 */
function stripGdprScripts(html) {
    return html
        // Scripts externos de GDPR/consent (osano.com)
        .replace(/<script\b[^>]*src=["'][^"']*osano[^"']*["'][^>]*(?:><\/script>|\/?>) */gi, '')
        // Scripts externos de analytics/tracking
        .replace(/<script\b[^>]*src=["'][^"']*(?:segment\.com|googletagmanager|sentry\.io|clarity\.ms|stripe\.com|js\.stripe)[^"']*["'][^>]*(?:><\/script>|\/?>) */gi, '')
        // Noscripts (fallbacks de GDPR)
        .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
}

/**
 * Estrategia 2: el background fetchea la página de Scribd con las cookies del usuario
 * para obtener el access_key, luego fetchea el embed.
 */
async function fetchScribdEmbed(docId) {
    const cookies    = await getScribdCookies();
    const cookieStr  = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const authHeaders = { ...SCRIBD_HEADERS, Cookie: cookieStr };

    // Paso 1: cargar la página del documento para extraer el access_key
    const pageUrl = `https://www.scribd.com/document/${docId}`;
    const pageRes = await fetch(pageUrl, { headers: authHeaders, redirect: 'follow' });

    if (!pageRes.ok) {
        throw new Error(`Scribd página ${pageRes.status} — ¿está logeado?`);
    }

    const pageHtml = await pageRes.text();
    const accessKey = extractAccessKey(pageHtml);

    if (!accessKey) {
        console.warn('[SDL BG] access_key no encontrado en el HTML de Scribd');
        return null;
    }

    console.debug('[SDL BG] access_key encontrado:', accessKey.substring(0, 10) + '...');

    // Paso 2: fetchear el embed con el access_key
    const embedUrl = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll`,
        `&access_key=${encodeURIComponent(accessKey)}`
    ].join('');

    const embedHeaders = {
        ...authHeaders,
        Referer: pageUrl
    };

    const embedRes = await fetch(embedUrl, { headers: embedHeaders, redirect: 'follow' });

    if (!embedRes.ok) {
        throw new Error(`Scribd embed ${embedRes.status}`);
    }

    const rawHtml = await embedRes.text();

    // Envolver en un documento limpio para que PDFShift lo renderice correctamente
    return prepareEmbedHtml(stripScripts(rawHtml));
}

/**
 * Extrae el access_key del HTML de la página de Scribd.
 * Scribd lo incrusta en el __NEXT_DATA__ o en scripts inline como JSON.
 */
function extractAccessKey(html) {
    const patterns = [
        // En __NEXT_DATA__ JSON (Next.js SSR)
        /"access_key"\s*:\s*"([a-zA-Z0-9_\-]{10,})"/,
        // En scripts inline como propiedad JS
        /access_key['":\s]+['"]([a-zA-Z0-9_\-]{10,})['"]/,
        // En data-attributes
        /data-access-key="([a-zA-Z0-9_\-]{10,})"/
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
    }

    return null;
}

/**
 * Prepara el HTML del embed de Scribd para PDFShift:
 * - Mantiene el <head> original con todos los <link> CSS de Scribd (scribdassets.com)
 *   para que PDFShift los cargue y mantenga negritas, tablas, colores, fuentes.
 * - Elimina scripts (ya strippeados antes) e inyecta solo un CSS de override.
 * NO reemplaza el HTML: lo aumenta. Esto preserva toda la fidelidad visual.
 */
function prepareEmbedHtml(html) {
    const overrideCSS = `<style id="sdl-overrides">
/* Fix: prevenir overflow horizontal */
html, body { overflow-x: hidden !important; }
* { max-width: 100% !important; box-sizing: border-box; }
img { max-width: 100% !important; height: auto !important; display: block; }

/* Ocultar UI de Scribd (toolbar, controles de navegación) */
[class*="toolbar_container"], [class*="toolbar"],
[class*="DocControls"], [class*="nav"] { display: none !important; }

/* Ocultar GDPR / Osano consent overlay */
[class*="osano"], [id*="osano"],
[class*="consent"], [id*="consent"],
[class*="cookie"], [id*="cookie"],
[class*="gdpr"],   [id*="gdpr"],
[role="dialog"][aria-modal="true"],
.sp-message-container { display: none !important; }
</style>`;

    // Inyectar DESPUÉS de los CSS de Scribd (mayor especificidad)
    if (html.includes('</head>')) {
        return html.replace('</head>', overrideCSS + '\n</head>');
    }
    // Fallback: anteponer si no hay </head>
    return overrideCSS + html;
}


/**
 * Enviar una URL directamente a PDFShift para que su Chromium headless la renderice.
 * Con las cookies del usuario, Scribd autentifica la sesión y sirve el documento completo.
 * PDFShift espera que la página cargue (.page_text visible) antes de capturar.
 *
 * Nota: las cookies deben ser solo {name, value} — PDFShift rechaza domain/path/etc.
 */
async function convertUrlToPdf(url, cookies = []) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    // PDFShift solo acepta {name, value} en el array de cookies
    const pdfCookies = cookies.map(c => ({ name: c.name, value: c.value }));

    const payload = {
        source:  url,
        format:  'A4',
        // Esperar a que React renderice el contenido del documento
        delay:   4000,
        // Margen mínimo para que las páginas no se corten
        margin:  { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        ...(pdfCookies.length > 0 && { cookies: pdfCookies })
    };

    let response;
    try {
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
        throw new Error(`PDFShift URL ${response.status}: ${errText}`);
    }

    return URL.createObjectURL(await response.blob());
}

// ─── HTML → PDFShift ─────────────────────────────────────────────
async function convertHtmlToPdf(htmlContent, printMode = false) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    const payload = {
        source:  htmlContent,
        format:  'A4',
        // DocumentManager necesita tiempo para crear los bordes/tablas via JS
        delay:   6000,
        ...(printMode && { media_type: 'print' })
    };

    let response;
    try {
        response = await fetch(PDFSHIFT.endpoint, {
            method:  'POST',
            headers: {
                'X-API-Key':    PDFSHIFT.apiKey,
                'Content-Type': 'application/json'
            },
            body:   JSON.stringify(payload),
            signal: controller.signal
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

function triggerDownload(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({ url, filename, saveAs: true }, (id) => {
            chrome.runtime.lastError
                ? reject(new Error(chrome.runtime.lastError.message))
                : resolve({ downloadId: id });
        });
    });
}

async function getScribdCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));
    } catch (err) {
        console.warn('[SDL BG] No se pudieron leer cookies:', err.message);
        return [];
    }
}

// ─── Keepalive ────────────────────────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sdl-keepalive') return;
    const interval = setInterval(() => {
        try { port.postMessage('ping'); } catch { clearInterval(interval); }
    }, 20_000);
    port.onDisconnect.addListener(() => clearInterval(interval));
});
