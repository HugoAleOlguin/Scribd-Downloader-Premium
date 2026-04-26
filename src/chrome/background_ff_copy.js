/**
 * Scribd Premium Downloader - Background Script (Firefox)
 * @version 4.0.0
 *
 * ESTRATEGIA PRINCIPAL: Imagen-por-página → HTML estático → PDFShift
 *
 * Scribd renderiza cada página como una imagen JPEG en html.scribdassets.com.
 * Todas las URLs están en el HTML del embed desde el inicio — sin lazy loading.
 *
 * Flujo:
 *  1. Fetchear HTML del embed (contiene URLs de imágenes de TODAS las páginas)
 *  2. Extraer las URLs de imágenes de página
 *  3. Descargar cada imagen con cookies del usuario → base64
 *  4. Construir HTML estático con <img> en base64
 *  5. PDFShift convierte HTML estático → PDF (sin JS, sin lazy loading)
 */

const PDFSHIFT = {
    endpoint: 'https://api.pdfshift.io/v3/convert/pdf',
    apiKey:   'sk_b44a585579aa75162adc2b86731707f2a3b5ef63',
    timeout:  120_000
};

const SCRIBD_UNIVERSAL_KEY = 'key-fFexxf7r1bzEfWu3HKwf';

const SCRIBD_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
    'Cache-Control':   'no-cache'
};

// ─── Listener de mensajes ─────────────────────────────────────────────────
// Firefox usa browser.runtime (basado en promesas), no chrome.runtime (callback)
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action !== 'generate_pdf') {
        return Promise.resolve({ success: true });
    }

    const tabId = sender.tab?.id ?? null;

    const sendProgress = (stage, percent = null) => {
        console.log(`%c[SDL] ${stage}`, 'color: #60a5fa; font-weight: bold');
        if (!tabId) return;
        // Firefox soporta browser.tabs.sendMessage con promesas
        browser.tabs.sendMessage(tabId, { action: 'sdl_progress', stage, percent })
            .catch(() => {});
    };

    return generateAndDownload(request, sendProgress)
        .then(result => ({ success: true, ...result }))
        .catch(err => {
            console.error('%c[SDL] ERROR:', 'color: #f87171; font-weight: bold', err.message);
            return { success: false, error: err.message || String(err) };
        });
});

// ─── Orquestador principal ────────────────────────────────────────────────
async function generateAndDownload(request, sendProgress) {
    const { html: domHtml, url, accessKey, filename } = request;
    const docId = extractDocId(url);

    console.group(`%c[SDL] Iniciando — docId: ${docId}`, 'color: #a78bfa; font-weight: bold');
    console.log('URL:', url);
    console.log('HTML DOM:', !!domHtml, domHtml ? `(${domHtml.length} chars)` : '');
    console.log('Access key:', !!accessKey);
    console.groupEnd();

    // ─── ESTRATEGIA 1: Imágenes de página → HTML estático → PDFShift ───────
    // Las URLs de imágenes están en el HTML inicial del embed — no hay lazy loading.
    // El background las descarga con las cookies del usuario (puede acceder a
    // scribdassets.com), construye un HTML autocontenido, y PDFShift solo ve
    // imágenes estáticas. Sin JavaScript remoto, sin scroll, sin problemas.
    if (docId) {
        try {
            sendProgress('Obteniendo estructura del documento...', 5);

            const embedHtml = await fetchRawEmbed(docId);
            const pageDims  = extractPageDimensions(embedHtml);
            const pageUrls  = extractPageImageUrls(embedHtml);

            console.log(`%c[SDL] Páginas en HTML: ${pageUrls.length}`,
                pageUrls.length > 0 ? 'color: #34d399' : 'color: #fbbf24');
            console.log('[SDL] Dims de página:', pageDims.width + 'x' + pageDims.height + 'px');

            if (pageUrls.length > 0) {
                sendProgress(`Descargando ${pageUrls.length} páginas...`, 15);

                const cookies  = await getScribdCookies();
                const b64Pages = await downloadPagesAsBase64(pageUrls, cookies, sendProgress);
                const okPages  = b64Pages.filter(Boolean).length;

                console.log(`[SDL] Imágenes OK: ${okPages}/${pageUrls.length}`);

                if (okPages > 0) {
                    sendProgress('Generando PDF en servidor...', 80);

                    const staticHtml = buildStaticHtml(b64Pages, pageDims, filename);
                    const blobUrl    = await convertStaticHtmlToPdf(staticHtml, pageDims);

                    console.log('%c[SDL] ESTRATEGIA 1 OK', 'color: #34d399; font-weight: bold');
                    sendProgress('PDF listo, guardando archivo...', 100);

                    const id = await browser.downloads.download({
                        url:     blobUrl,
                        filename: `${filename}.pdf`,
                        saveAs:  true
                    });
                    return { downloadId: id };
                }
            }

            console.warn('[SDL] Estrategia 1: sin imágenes válidas, probando siguiente...');
        } catch (err) {
            console.warn('[SDL] Estrategia 1 falló:', err.message);
        }
    }

    // ─── ESTRATEGIA 2: Descarga directa de Scribd (suscriptores) ───────────
    if (docId) {
        try {
            sendProgress('Intentando descarga directa de Scribd...', 35);
            console.log('[SDL] Estrategia 2: descarga directa...');

            const directUrl = await tryScribdDirectDownload(docId);
            if (directUrl) {
                console.log('%c[SDL] ESTRATEGIA 2 OK — PDF directo', 'color: #34d399; font-weight: bold');
                sendProgress('PDF de Scribd descargado directamente', 100);
                const id = await browser.downloads.download({
                    url: directUrl, filename: `${filename}.pdf`, saveAs: true
                });
                return { downloadId: id };
            }
        } catch (err) {
            console.warn('[SDL] Estrategia 2 falló:', err.message);
        }
    }

    // ─── ESTRATEGIA 3: Access key del usuario ──────────────────────────────
    if (docId && accessKey) {
        try {
            sendProgress('Usando access_key del usuario...', 40);
            console.log('[SDL] Estrategia 3: access_key del usuario...');

            const embedHtml = await fetchEmbedWithKey(docId, accessKey);
            const pageDims  = extractPageDimensions(embedHtml);
            const pageUrls  = extractPageImageUrls(embedHtml);

            console.log(`[SDL] Estrategia 3: ${pageUrls.length} páginas`);

            if (pageUrls.length > 0) {
                const cookies  = await getScribdCookies();
                const b64Pages = await downloadPagesAsBase64(pageUrls, cookies, sendProgress);
                const okPages  = b64Pages.filter(Boolean).length;

                if (okPages > 0) {
                    sendProgress('Generando PDF...', 80);
                    const staticHtml = buildStaticHtml(b64Pages, pageDims, filename);
                    const blobUrl    = await convertStaticHtmlToPdf(staticHtml, pageDims);

                    console.log('%c[SDL] ESTRATEGIA 3 OK', 'color: #34d399; font-weight: bold');
                    sendProgress('PDF listo', 100);
                    const id = await browser.downloads.download({
                        url: blobUrl, filename: `${filename}.pdf`, saveAs: true
                    });
                    return { downloadId: id };
                }
            }
        } catch (err) {
            console.warn('[SDL] Estrategia 3 falló:', err.message);
        }
    }

    // ─── ESTRATEGIA 4: HTML del DOM (fallback) ─────────────────────────────
    if (domHtml && domHtml.length > 500) {
        try {
            sendProgress('Convirtiendo HTML del DOM...', 50);
            console.log('[SDL] Estrategia 4: HTML del DOM (', domHtml.length, 'chars)...');

            const blobUrl = await convertStaticHtmlToPdf(domHtml, { width: 902, height: 1167 });

            console.log('%c[SDL] ESTRATEGIA 4 OK', 'color: #34d399; font-weight: bold');
            sendProgress('PDF listo', 100);
            const id = await browser.downloads.download({
                url: blobUrl, filename: `${filename}.pdf`, saveAs: true
            });
            return { downloadId: id };
        } catch (err) {
            console.warn('[SDL] Estrategia 4 falló:', err.message);
        }
    }

    throw new Error(
        'No se pudo descargar el documento. ' +
        'Asegúrate de estar en la página de un documento de Scribd.'
    );
}

// ─── Extracción de URLs de imágenes de página ─────────────────────────────
/**
 * Scribd renderiza cada página como una imagen JPEG en html.scribdassets.com.
 * Las URLs están en el HTML inicial — no requieren que el usuario scrollee.
 * Pueden estar en src="" o data-src="" (lazy load de Scribd, pero las URLs
 * ya existen en el DOM inicial aunque la imagen no haya cargado aún).
 */
function extractPageImageUrls(html) {
    const seen = new Set();
    const urls = [];

    // Scribd mete las URLs de TODAS las páginas en bloques <script> como JSON/JS,
    // no en atributos src/data-src de <img>. Solo la página 1 (la visible al cargar)
    // puede tener un src="" directo. Las demás están en el JavaScript del embed.
    //
    // La regex busca en el texto COMPLETO del HTML (incluyendo script tags)
    // cualquier URL de imágenes de scribdassets.com con formato de página.
    // Formato típico: https://html.scribdassets.com/{hash}/images/{N}-{hash}.{ext}
    const imgUrlRe = /https?:\/\/html\.scribdassets\.com\/[a-zA-Z0-9]+\/images\/\d+-[a-f0-9]+\.(?:jpg|jpeg|png|webp)/gi;

    let m;
    while ((m = imgUrlRe.exec(html)) !== null) {
        const url = m[0];
        if (!seen.has(url)) {
            seen.add(url);
            urls.push(url);
        }
    }

    // Ordenar por número de página (el número antes del guión en el nombre del archivo)
    // Formato: images/3-abc123.png → página 3
    urls.sort((a, b) => {
        const pageNum = url => {
            const match = url.match(/\/images\/(\d+)-/);
            return match ? parseInt(match[1]) : 0;
        };
        return pageNum(a) - pageNum(b);
    });

    console.log('[SDL] URLs de páginas encontradas en HTML completo:', urls.length);
    if (urls.length > 0) {
        console.log('[SDL] Páginas:', urls.map(u => u.match(/\/images\/(\d+)-/)?.[1]).join(', '));
        console.log('[SDL] Ejemplo URL p1:', urls[0].substring(0, 90));
    } else {
        console.warn('[SDL] CERO URLs encontradas — el HTML no contiene imágenes de scribdassets.com');
        console.warn('[SDL] Primeros 500 chars del embed:', html.substring(0, 500));
    }

    return urls;
}

/**
 * Descarga todas las imágenes de página como base64.
 * Lotes de 5 paralelos para equilibrar velocidad y memoria.
 */
async function downloadPagesAsBase64(urls, cookies, sendProgress) {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const results   = new Array(urls.length).fill(null);
    const BATCH     = 5;

    for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        const pct   = Math.round(15 + ((i / urls.length) * 60));
        sendProgress(`Página ${i + 1}–${Math.min(i + BATCH, urls.length)} de ${urls.length}`, pct);

        await Promise.all(batch.map(async (url, batchIdx) => {
            const globalIdx = i + batchIdx;
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 20_000);

                const res = await fetch(url, {
                    headers: {
                        ...SCRIBD_HEADERS,
                        'Cookie':  cookieStr,
                        'Referer': 'https://www.scribd.com/',
                        'Accept':  'image/webp,image/jpeg,image/*'
                    },
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (!res.ok) {
                    console.warn(`[SDL] Imagen ${globalIdx + 1} HTTP ${res.status}`);
                    return;
                }

                const buffer = await res.arrayBuffer();
                const mime   = res.headers.get('content-type') || 'image/jpeg';
                const b64    = btoa(
                    new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
                );
                results[globalIdx] = { dataUri: `data:${mime};base64,${b64}`, mime };
                console.log(`[SDL] OK página ${globalIdx + 1}/${urls.length}`);
            } catch (err) {
                console.warn(`[SDL] Error página ${globalIdx + 1}:`, err.message);
            }
        }));
    }

    return results;
}

/**
 * Construye un HTML estático autocontenido con todas las páginas como <img>.
 * Sin JavaScript, sin CSS externo → PDFShift lo renderiza instantáneamente.
 */
function buildStaticHtml(b64Pages, pageDims, title = 'documento') {
    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    const imgTags = b64Pages.map((page, i) => {
        if (!page) {
            return `<div style="width:${pageW}px;height:${pageH}px;background:#fff;display:flex;align-items:center;justify-content:center;color:#aaa;font-family:sans-serif;font-size:14px">Página ${i + 1} no disponible</div>`;
        }
        return `<img src="${page.dataUri}" width="${pageW}" height="${pageH}" alt="Página ${i + 1}">`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${pageW}">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${pageW}px; }
  img { display: block; page-break-after: always; }
</style>
</head>
<body>
${imgTags}
</body>
</html>`;
}

// ─── PDFShift ─────────────────────────────────────────────────────────────
async function convertStaticHtmlToPdf(htmlContent, pageDims = { width: 902, height: 1167 }) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), PDFSHIFT.timeout);

    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    // PDFShift v3: viewport debe ser string "WxH", NO un objeto {width, height}
    // Error confirmado: "Couldn't interpret '{...}' as string"
    const payload = {
        source:   htmlContent,
        viewport: `${pageW}x${pageH}`,
        zoom:     1,
        margin:   '0mm',
        delay:    500
    };

    console.log('[SDL] PDFShift: viewport', `${pageW}x${pageH}`, '| source:', htmlContent.length, 'chars');

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
        console.error('[SDL] PDFShift error:', response.status, errText.substring(0, 200));
        throw new Error(`PDFShift ${response.status}: ${errText.substring(0, 100)}`);
    }

    const blob = await response.blob();
    console.log('[SDL] PDF OK —', Math.round(blob.size / 1024), 'KB');
    return URL.createObjectURL(blob);
}

// ─── Fetch del embed de Scribd ─────────────────────────────────────────────
async function fetchRawEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=${SCRIBD_UNIVERSAL_KEY}&show_recommendations=false`;

    console.log('[SDL] Fetching embed para docId:', docId);

    const res = await fetch(url, {
        headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }
    });

    if (!res.ok) throw new Error(`Embed HTTP ${res.status}`);

    const html = await res.text();
    console.log('[SDL] Embed recibido:', html.length, 'chars');

    if (html.length < 3_000) throw new Error(`Embed muy corto (${html.length} chars)`);
    return html;
}

async function fetchEmbedWithKey(docId, accessKey) {
    const url = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=${encodeURIComponent(accessKey)}&show_recommendations=false`;
    const res = await fetch(url, { headers: SCRIBD_HEADERS });
    if (!res.ok) throw new Error(`Embed con access_key HTTP ${res.status}`);
    return res.text();
}

async function tryScribdDirectDownload(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const endpoints = [
        `https://www.scribd.com/document_downloads/download/${docId}?extension=pdf`,
        `https://www.scribd.com/document_downloads/${docId}?extension=pdf`
    ];

    for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
            headers: { ...SCRIBD_HEADERS, Cookie: cookieStr },
            redirect: 'follow'
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && (ct.includes('pdf') || ct.includes('octet-stream'))) {
            const blob = await res.blob();
            console.log('[SDL] PDF directo:', Math.round(blob.size / 1024), 'KB');
            return URL.createObjectURL(blob);
        }
    }
    return null;
}

// ─── Utilidades ───────────────────────────────────────────────────────────
function extractPageDimensions(html) {
    const m1 = html.match(/class="outer_page[^"]*"[^>]*style="[^"]*width:(\d+)px[^"]*height:(\d+)px/);
    if (m1) return { width: parseInt(m1[1]), height: parseInt(m1[2]) };

    const m2 = html.match(/id="page\d+"[^>]*style="[^"]*width:\s*(\d+)px[^"]*height:\s*(\d+)px/);
    if (m2) return { width: parseInt(m2[1]), height: parseInt(m2[2]) };

    const m3 = html.match(/data-width="(\d+)"[^>]*data-height="(\d+)"/);
    if (m3) return { width: parseInt(m3[1]), height: parseInt(m3[2]) };

    console.warn('[SDL] Dimensiones no encontradas, usando 902x1167');
    return { width: 902, height: 1167 };
}

function extractDocId(url) {
    return url?.match(/\/(?:document|doc|embeds|read|book)\/(\d+)/)?.[1] ?? null;
}

async function getScribdCookies() {
    try {
        const cookies = await browser.cookies.getAll({ domain: 'scribd.com' });
        return cookies.map(c => ({ name: c.name, value: c.value }));
    } catch (err) {
        console.warn('[SDL] Cookies no disponibles:', err.message);
        return [];
    }
}
