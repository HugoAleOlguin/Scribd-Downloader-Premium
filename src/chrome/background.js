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
async function generateAndDownload({ html: domHtml, url, filename }) {
    const docId = extractDocId(url);

    // ── Estrategia 1: fetch directo a Scribd con cookies del usuario ──────
    if (docId) {
        try {
            const embedHtml = await fetchScribdEmbed(docId);
            if (embedHtml) {
                console.debug('[SDL BG] Estrategia 1 OK: embed obtenido de Scribd');
                const objectUrl = await convertHtmlToPdf(embedHtml, filename);
                return triggerDownload(objectUrl, `${filename}.pdf`);
            }
        } catch (err) {
            console.warn('[SDL BG] Estrategia 1 falló:', err.message);
        }
    }

    // ── Estrategia 2: HTML capturado del DOM por content.js ───────────────
    if (domHtml) {
        console.debug('[SDL BG] Estrategia 2: usando HTML del DOM del content script');
        const objectUrl = await convertHtmlToPdf(domHtml, filename);
        return triggerDownload(objectUrl, `${filename}.pdf`);
    }

    throw new Error(
        'No se pudo obtener el contenido. ' +
        'Asegúrate de que el documento esté completamente cargado y vuelve a intentar.'
    );
}

// ─── Estrategia 1: fetch autenticado a Scribd ─────────────────────────────

/**
 * Obtiene el embed HTML de Scribd usando las cookies de sesión del usuario.
 * Las extensiones con host_permissions pueden enviar el header Cookie
 * manualmente sin restricciones CORS.
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
async function convertHtmlToPdf(htmlContent, filename) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    let response;
    try {
        response = await fetch(PDFSHIFT.endpoint, {
            method:  'POST',
            headers: {
                'X-API-Key':    PDFSHIFT.apiKey,
                'Content-Type': 'application/json'
            },
            body:   JSON.stringify({ source: htmlContent, format: 'A4' }),
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
