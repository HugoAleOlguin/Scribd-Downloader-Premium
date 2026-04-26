/**
 * Scribd Downloader - Background Script (Firefox/MV3)
 * @version 5.0.0 (local/develop)
 *
 * NOTA: Firefox MV3 background usa "type": "module" — no tenemos importScripts().
 * pdf-lib se carga dinámicamente via fetch + Function eval (patrón estándar para UMD en module workers).
 *
 * ESTRATEGIA ÚNICA: scribd-dl approach
 *   embed URL → extraer imágenes → descargar → pdf-lib → chrome.downloads
 */

// ─── Carga de pdf-lib en contexto module ──────────────────────────────────

let PDFLib = null;

async function loadPdfLib() {
    if (PDFLib) return PDFLib;

    // Fetch el script UMD local y evaluarlo en el contexto global
    const url  = browser.runtime.getURL('libs/pdf-lib.min.js');
    const resp = await fetch(url);
    const code = await resp.text();

    // Ejecutar el bundle UMD para que defina self.PDFLib
    const fn = new Function(code);
    fn();

    PDFLib = self.PDFLib;
    return PDFLib;
}

// ─── Constantes ────────────────────────────────────────────────────────────

const SCRIBD_EMBED_KEY = 'key-fFexxf7r1bzEfWu3HKwf';

const SCRIBD_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5',
    'Cache-Control':   'no-cache'
};

// ─── Listener principal ────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action !== 'generate_pdf') return;

    const tabId = sender.tab?.id ?? null;

    const sendProgress = (stage, percent = null) => {
        console.log(`[SDL] ${stage}`);
        if (!tabId) return;
        browser.tabs.sendMessage(tabId, { action: 'sdl_progress', stage, percent }).catch(() => {});
    };

    return generateAndDownload(request, sendProgress);
});

// ─── Orquestador ───────────────────────────────────────────────────────────

async function generateAndDownload({ url, filename }, sendProgress) {
    const docId = extractDocId(url);
    if (!docId) {
        return { success: false, error: 'No se encontró ID de documento en la URL de Scribd.' };
    }

    try {
        sendProgress('Cargando motor PDF...', 3);
        await loadPdfLib();

        sendProgress('Obteniendo estructura del documento...', 5);
        const embedHtml = await fetchEmbed(docId);

        sendProgress('Analizando páginas...', 15);
        const pageUrls = extractPageImageUrls(embedHtml);

        if (pageUrls.length === 0) {
            return {
                success: false,
                error: 'No se encontraron imágenes de página. El documento puede requerir sesión activa en Scribd.'
            };
        }

        const pageDims = extractPageDimensions(embedHtml);
        console.log(`[SDL] ${pageDims.width}×${pageDims.height} | ${pageUrls.length} páginas`);

        const cookies   = await getScribdCookies();
        const imageData = await downloadImages(pageUrls, cookies, sendProgress);
        const validPages = imageData.filter(Boolean).length;

        if (validPages === 0) {
            return { success: false, error: 'No se pudo descargar ninguna imagen de página.' };
        }

        sendProgress(`Generando PDF (${validPages} páginas)...`, 85);
        const pdfBytes = await buildPdf(imageData, pageDims);

        sendProgress('Guardando archivo...', 98);
        const blob    = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl  = URL.createObjectURL(blob);
        const dlId    = await triggerDownload(pdfUrl, `${filename}.pdf`);

        sendProgress('¡Listo!', 100);
        return { success: true, downloadId: dlId };

    } catch (err) {
        console.error('[SDL] Error:', err.message);
        return { success: false, error: err.message };
    }
}

// ─── Fetch del embed de Scribd ─────────────────────────────────────────────

async function fetchEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=${SCRIBD_EMBED_KEY}&show_recommendations=false`;

    console.log('[SDL] Fetching embed docId:', docId);
    const res = await fetch(url, {
        headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }
    });

    if (!res.ok) throw new Error(`Error al obtener el embed (HTTP ${res.status})`);

    const html = await res.text();
    if (html.length < 3_000) {
        throw new Error(`Respuesta del embed demasiado corta (${html.length} chars).`);
    }

    return html;
}

// ─── Extracción de URLs de imágenes ───────────────────────────────────────

function extractPageImageUrls(html) {
    const seen = new Set();
    const urls = [];

    const normalized = html.replace(/\\\//g, '/');
    const imgUrlRe   = /https?:\/\/html\.scribdassets\.com\/[a-zA-Z0-9]+\/images\/\d+-[a-f0-9]+\.(?:jpg|jpeg|png|webp)/gi;

    let match;
    while ((match = imgUrlRe.exec(normalized)) !== null) {
        const url = match[0];
        if (!seen.has(url)) {
            seen.add(url);
            urls.push(url);
        }
    }

    urls.sort((a, b) => {
        const pageNum = u => parseInt(u.match(/\/images\/(\d+)-/)?.[1] ?? '0');
        return pageNum(a) - pageNum(b);
    });

    console.log('[SDL] Páginas encontradas:', urls.length);
    return urls;
}

// ─── Descarga de imágenes ──────────────────────────────────────────────────

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
                    console.warn(`[SDL] Página ${idx + 1} HTTP ${res.status}`);
                    return;
                }

                const buffer = await res.arrayBuffer();
                const mime   = res.headers.get('content-type') || 'image/jpeg';
                results[idx] = { bytes: new Uint8Array(buffer), mime };

            } catch (err) {
                console.warn(`[SDL] Error página ${idx + 1}:`, err.message);
            }
        }));
    }

    console.log(`[SDL] Descargadas: ${results.filter(Boolean).length}/${urls.length}`);
    return results;
}

// ─── Generación de PDF con pdf-lib ────────────────────────────────────────

async function buildPdf(imageData, pageDims) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    for (let i = 0; i < imageData.length; i++) {
        const item = imageData[i];

        if (!item) {
            pdfDoc.addPage([pageW, pageH]);
            continue;
        }

        let { bytes, mime } = item;

        if (mime.includes('webp')) {
            try {
                bytes = await convertWebpToJpeg(bytes);
                mime  = 'image/jpeg';
            } catch (err) {
                console.warn(`[SDL] WebP conversión falló p${i + 1}:`, err.message);
                pdfDoc.addPage([pageW, pageH]);
                continue;
            }
        }

        try {
            let image;
            if (mime.includes('jpeg') || mime.includes('jpg')) {
                image = await pdfDoc.embedJpg(bytes);
            } else {
                image = await pdfDoc.embedPng(bytes);
            }

            const page = pdfDoc.addPage([pageW, pageH]);
            page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });

        } catch (err) {
            console.warn(`[SDL] Error embed imagen p${i + 1}:`, err.message);
            pdfDoc.addPage([pageW, pageH]);
        }
    }

    const pdfBytes = await pdfDoc.save();
    console.log(`[SDL] PDF: ${Math.round(pdfBytes.length / 1024)} KB | ${pdfDoc.getPageCount()} páginas`);
    return pdfBytes;
}

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

    return { width: 902, height: 1167 };
}

function triggerDownload(url, filename) {
    return new Promise((resolve, reject) => {
        browser.downloads.download({ url, filename, saveAs: false }, (id) => {
            browser.runtime.lastError
                ? reject(new Error(browser.runtime.lastError.message))
                : resolve(id);
        });
    });
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
