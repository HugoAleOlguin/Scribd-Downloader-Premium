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

    // ── Estrategia A: embed con access_key (páginas externas o cuando se interceptó) ─
    // El embed URL con access_key es accesible sin cuenta ni suscripción.
    if (docId && accessKey) {
        try {
            console.log('[SDL BG] Estrategia A: embed con access_key (sin cuenta)...');
            const embedHtml = await fetchEmbedWithKey(docId, accessKey);
            const objectUrl = await convertHtmlToPdf(embedHtml, false);
            return triggerDownload(objectUrl, `${filename}.pdf`);
        } catch (err) {
            console.log('[SDL BG] Estrategia A falló:', err.message);
        }
    }

    // ── Estrategia B: descarga directa de Scribd (suscriptores) ─────────────
    if (docId) {
        try {
            const directUrl = await tryScribdDirectDownload(docId);
            if (directUrl) {
                console.log('[SDL BG] Estrategia B OK: PDF directo de Scribd');
                return triggerDownload(directUrl, `${filename}.pdf`);
            }
        } catch (err) {
            console.log('[SDL BG] Estrategia B falló:', err.message);
        }
    }

    // ── Estrategia C: HTML del body capturado por content.js ────────────
    if (domHtml) {
        try {
            console.log('[SDL BG] Estrategia C: convirtiendo HTML del DOM a PDF (printMode:', printMode, ')...');
            const objectUrl = await convertHtmlToPdf(domHtml, printMode);
            return triggerDownload(objectUrl, `${filename}.pdf`);
        } catch (err) {
            console.log('[SDL BG] Estrategia C falló:', err.message);
        }
    }

    throw new Error(
        domHtml
            ? 'El servidor PDF rechazó el contenido capturado.'
            : 'No se pudo obtener el contenido. La cuenta de Scribd no tiene permisos de descarga o el documento no está disponible.'
    );
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
 * Estrategia 1: fetchear el embed usando un access_key ya conocido.
 * No requiere cookies. El embed URL fue diseñado para acceso externo con este token.
 */
async function fetchEmbedWithKey(docId, accessKey) {
    const embedUrl = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll`,
        `&access_key=${encodeURIComponent(accessKey)}`
    ].join('');

    const res = await fetch(embedUrl, {
        headers: { ...SCRIBD_HEADERS }
    });

    if (!res.ok) throw new Error(`Scribd embed ${res.status}`);
    return wrapEmbedHtml(await res.text());
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
    return wrapEmbedHtml(rawHtml, docId);
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
 * Envuelve el HTML del embed de Scribd en un documento HTML limpio
 * con estilos de impresión básicos para que PDFShift lo renderice bien.
 */
function wrapEmbedHtml(html, docId) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: white; color: black; font-family: Georgia, serif; }
    [class*="page"], .outer_page { page-break-after: always; background: white; }
    img { max-width: 100%; height: auto; }
    /* Ocultar UI de Scribd */
    .toolbar_container, .toolbar, .header, nav, [class*="toolbar"] { display: none !important; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ─── Estrategia 2: HTML → PDFShift ───────────────────────────────────────
async function convertHtmlToPdf(htmlContent, printMode = false) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    const payload = {
        source:  htmlContent,
        format:  'A4',
        // print media activa los @media print de Scribd (oculta nav/sidebar)
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
