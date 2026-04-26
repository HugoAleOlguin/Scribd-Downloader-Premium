/**
 * Scribd Downloader - Background Service Worker (Chrome/MV3)
 * @version 5.0.0 (local/develop)
 *
 * ESTRATEGIA ÚNICA: scribd-dl approach
 *   1. Obtener el HTML del embed de Scribd (igual que rkwyu/scribd-dl)
 *   2. Extraer URLs de imágenes de las páginas
 *   3. Descargar imágenes como binario
 *   4. Construir PDF localmente con pdf-lib (sin APIs externas)
 *   5. Entregar al navegador via chrome.downloads
 *
 * Sin PDFShift, sin servidores externos, sin instalaciones adicionales.
 */

// pdf-lib se carga como archivo local — expone window.PDFLib en global scope
importScripts('libs/pdf-lib.min.js');

// ─── Constantes ────────────────────────────────────────────────────────────

const SCRIBD_EMBED_KEY = 'key-fFexxf7r1bzEfWu3HKwf';

const SCRIBD_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
    'Cache-Control':   'no-cache'
};

// ─── Listener principal ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'generate_pdf') {
        sendResponse({ success: true });
        return;
    }

    const tabId = sender.tab?.id ?? null;

    const sendProgress = (stage, percent = null) => {
        console.log(`%c[SDL] ${stage}`, 'color:#60a5fa;font-weight:bold');
        if (!tabId) return;
        chrome.tabs.sendMessage(tabId, { action: 'sdl_progress', stage, percent }).catch(() => {});
    };

    generateAndDownload(request, sendProgress)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => {
            console.error('%c[SDL] ERROR:', 'color:#f87171;font-weight:bold', err.message);
            sendResponse({ success: false, error: err.message });
        });

    return true; // Mantiene el canal de respuesta abierto (async)
});

// ─── Orquestador ───────────────────────────────────────────────────────────

async function generateAndDownload({ url, filename }, sendProgress) {
    const docId = extractDocId(url);
    if (!docId) {
        throw new Error('No se encontró ID de documento en la URL de Scribd.');
    }

    // Paso 1 — Obtener embed HTML (igual que scribd-dl)
    sendProgress('Obteniendo estructura del documento...', 5);
    const embedHtml = await fetchEmbed(docId);

    // Paso 2 — Extraer URLs de imágenes de páginas
    sendProgress('Analizando páginas...', 15);
    const pageUrls = extractPageImageUrls(embedHtml);

    if (pageUrls.length === 0) {
        throw new Error(
            'No se encontraron imágenes de página. ' +
            'El documento puede requerir una sesión activa de Scribd.'
        );
    }

    const pageDims = extractPageDimensions(embedHtml);
    console.log(`[SDL] Dimensiones: ${pageDims.width}x${pageDims.height} | Páginas: ${pageUrls.length}`);

    // Paso 3 — Descargar imágenes
    const cookies    = await getScribdCookies();
    const imageData  = await downloadImages(pageUrls, cookies, sendProgress);
    const validPages = imageData.filter(Boolean).length;

    if (validPages === 0) {
        throw new Error('No se pudo descargar ninguna imagen de página.');
    }

    // Paso 4 — Generar PDF localmente
    sendProgress(`Generando PDF (${validPages} páginas)...`, 85);
    const pdfBytes = await buildPdf(imageData, pageDims);

    // Paso 5 — Entregar al navegador como descarga
    sendProgress('Guardando archivo...', 98);
    const blob   = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(blob);

    sendProgress('¡Listo!', 100);
    return triggerDownload(pdfUrl, `${filename}.pdf`);
}

// ─── Fetch del embed de Scribd ─────────────────────────────────────────────

/**
 * Igual que scribd-dl: obtiene el HTML completo del embed incluyendo
 * todos los scripts internos donde están las URLs de imágenes.
 */
async function fetchEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=${SCRIBD_EMBED_KEY}&show_recommendations=false`;

    console.log('[SDL] Fetching embed para docId:', docId);
    const res = await fetch(url, {
        headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }
    });

    if (!res.ok) throw new Error(`Error al obtener el embed (HTTP ${res.status})`);

    const html = await res.text();
    console.log('[SDL] Embed recibido:', html.length, 'chars');

    if (html.length < 3_000) {
        throw new Error(`Respuesta del embed demasiado corta (${html.length} chars). Verifica que estás en un documento válido.`);
    }

    return html;
}

// ─── Extracción de URLs de imágenes ───────────────────────────────────────

/**
 * Busca en el HTML completo del embed todas las URLs de imágenes de página.
 * Técnica directamente de scribd-dl: normalizar JSON escaped slashes (\\/)
 * para que la regex encuentre URLs tanto en src="" como en JSON embebido.
 */
function extractPageImageUrls(html) {
    const seen = new Set();
    const urls = [];

    // JSON dentro de <script> escapa los slashes como \/
    const normalized = html.replace(/\\\//g, '/');

    const imgUrlRe = /https?:\/\/html\.scribdassets\.com\/[a-zA-Z0-9]+\/images\/\d+-[a-f0-9]+\.(?:jpg|jpeg|png|webp)/gi;

    let match;
    while ((match = imgUrlRe.exec(normalized)) !== null) {
        const url = match[0];
        if (!seen.has(url)) {
            seen.add(url);
            urls.push(url);
        }
    }

    // Ordenar por número de página (número antes del guión en el filename)
    urls.sort((a, b) => {
        const pageNum = u => parseInt(u.match(/\/images\/(\d+)-/)?.[1] ?? '0');
        return pageNum(a) - pageNum(b);
    });

    console.log('[SDL] Páginas encontradas:', urls.length);
    return urls;
}

// ─── Descarga de imágenes ──────────────────────────────────────────────────

/**
 * Descarga las imágenes en lotes de 5 en paralelo.
 * Retorna un array de { bytes: Uint8Array, mime: string } | null.
 */
async function downloadImages(urls, cookies, sendProgress) {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const results   = new Array(urls.length).fill(null);
    const BATCH     = 5;

    for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        const pct   = Math.round(20 + ((i / urls.length) * 60));
        sendProgress(
            `Descargando página ${i + 1}–${Math.min(i + BATCH, urls.length)} de ${urls.length}`,
            pct
        );

        await Promise.all(batch.map(async (url, batchIdx) => {
            const idx = i + batchIdx;
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 25_000);

                const res = await fetch(url, {
                    headers: {
                        ...SCRIBD_HEADERS,
                        'Cookie':  cookieStr,
                        'Referer': 'https://www.scribd.com/',
                        'Accept':  'image/webp,image/jpeg,image/png,image/*'
                    },
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (!res.ok) {
                    console.warn(`[SDL] Página ${idx + 1} falló (HTTP ${res.status})`);
                    return;
                }

                const buffer = await res.arrayBuffer();
                const mime   = res.headers.get('content-type') || 'image/jpeg';
                results[idx] = { bytes: new Uint8Array(buffer), mime };

            } catch (err) {
                console.warn(`[SDL] Error descargando página ${idx + 1}:`, err.message);
            }
        }));
    }

    const ok = results.filter(Boolean).length;
    console.log(`[SDL] Imágenes descargadas: ${ok}/${urls.length}`);
    return results;
}

// ─── Generación de PDF con pdf-lib ────────────────────────────────────────

/**
 * Construye el PDF final usando pdf-lib (sin APIs externas).
 * Soporta JPEG y PNG directamente.
 * WebP se convierte a JPEG via OffscreenCanvas (disponible en service workers).
 */
async function buildPdf(imageData, pageDims) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    // Convertir píxeles a puntos PDF (1pt = 1px en pdf-lib cuando se especifican unidades)
    for (let i = 0; i < imageData.length; i++) {
        const item = imageData[i];

        if (!item) {
            // Página faltante: añadir página en blanco para mantener numeración
            pdfDoc.addPage([pageW, pageH]);
            continue;
        }

        let { bytes, mime } = item;

        // WebP no es soportado por pdf-lib — convertir a JPEG usando OffscreenCanvas
        if (mime.includes('webp')) {
            try {
                bytes = await convertWebpToJpeg(bytes);
                mime  = 'image/jpeg';
            } catch (err) {
                console.warn(`[SDL] No se pudo convertir WebP p${i + 1}:`, err.message);
                pdfDoc.addPage([pageW, pageH]);
                continue;
            }
        }

        try {
            let image;
            if (mime.includes('jpeg') || mime.includes('jpg')) {
                image = await pdfDoc.embedJpg(bytes);
            } else if (mime.includes('png')) {
                image = await pdfDoc.embedPng(bytes);
            } else {
                // Tipo desconocido: intentar como JPEG (la mayoría son JPEG)
                image = await pdfDoc.embedJpg(bytes);
            }

            const page = pdfDoc.addPage([pageW, pageH]);
            page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });

        } catch (err) {
            console.warn(`[SDL] Error embebiendo imagen p${i + 1}:`, err.message);
            pdfDoc.addPage([pageW, pageH]);
        }
    }

    const pdfBytes = await pdfDoc.save();
    console.log(`[SDL] PDF generado: ${Math.round(pdfBytes.length / 1024)} KB | ${pdfDoc.getPageCount()} páginas`);
    return pdfBytes;
}

/**
 * Convierte bytes WebP a JPEG usando OffscreenCanvas.
 * OffscreenCanvas está disponible en service workers de Chrome.
 */
async function convertWebpToJpeg(webpBytes) {
    const blob        = new Blob([webpBytes], { type: 'image/webp' });
    const imageBitmap = await createImageBitmap(blob);
    const canvas      = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx         = canvas.getContext('2d');

    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return new Uint8Array(await jpegBlob.arrayBuffer());
}

// ─── Utilidades ────────────────────────────────────────────────────────────

function extractDocId(url) {
    return url?.match(/\/(?:document|doc|embeds|read|book|presentation)\/(\d+)/)?.[1] ?? null;
}

function extractPageDimensions(html) {
    const m1 = html.match(/class="outer_page[^"]*"[^>]*style="[^"]*width:(\d+)px[^"]*height:(\d+)px/);
    if (m1) return { width: parseInt(m1[1]), height: parseInt(m1[2]) };

    const m2 = html.match(/id="page\d+"[^>]*style="[^"]*width:\s*(\d+)px[^"]*height:\s*(\d+)px/);
    if (m2) return { width: parseInt(m2[1]), height: parseInt(m2[2]) };

    const m3 = html.match(/data-width="(\d+)"[^>]*data-height="(\d+)"/);
    if (m3) return { width: parseInt(m3[1]), height: parseInt(m3[2]) };

    console.warn('[SDL] Dimensiones no encontradas, usando 902×1167 por defecto');
    return { width: 902, height: 1167 };
}

function triggerDownload(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({ url, filename, saveAs: false }, (id) => {
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
        console.warn('[SDL] Cookies no disponibles:', err.message);
        return [];
    }
}

// ─── Keepalive (evita que el service worker se apague durante descargas largas) ─

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sdl-keepalive') return;
    const interval = setInterval(() => {
        try { port.postMessage('ping'); } catch { clearInterval(interval); }
    }, 20_000);
    port.onDisconnect.addListener(() => clearInterval(interval));
});
