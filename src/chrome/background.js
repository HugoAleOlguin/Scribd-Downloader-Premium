/**
 * Scribd Downloader - Background Service Worker (Chrome/MV3)
 * @version 5.1.0 (local/develop)
 *
 * ESTRATEGIA ÚNICA: scribd-dl approach — sin librerías externas
 *   1. Fetch del embed HTML de Scribd
 *   2. Extracción de URLs de imágenes de página
 *   3. Descarga de imágenes en batches
 *   4. Construcción de PDF inline (sin eval, sin new Function → CSP-safe)
 *   5. Entrega al navegador via chrome.downloads
 */

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

    // Paso 1 — Obtener embed HTML (mismo enfoque que rkwyu/scribd-dl)
    sendProgress('Obteniendo estructura del documento...', 5);
    const embedHtml = await fetchEmbed(docId);

    // Paso 2 — Extraer URLs de imágenes de páginas del HTML completo
    sendProgress('Analizando páginas...', 15);
    const pageUrls = extractPageImageUrls(embedHtml);

    if (pageUrls.length === 0) {
        throw new Error(
            'No se encontraron imágenes de página. ' +
            'El documento puede requerir una sesión activa en Scribd.'
        );
    }

    const pageDims = extractPageDimensions(embedHtml);
    console.log(`[SDL] Dimensiones: ${pageDims.width}×${pageDims.height} | ${pageUrls.length} páginas`);

    // Paso 3 — Descargar imágenes en batches
    const cookies   = await getScribdCookies();
    const imageData = await downloadImages(pageUrls, cookies, sendProgress);

    const validCount = imageData.filter(Boolean).length;
    if (validCount === 0) {
        throw new Error('No se pudo descargar ninguna imagen de página.');
    }

    // Paso 4 — Construir PDF localmente (sin librerías externas, CSP-safe)
    sendProgress(`Generando PDF (${validCount} páginas)...`, 85);
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
 * Obtiene el HTML completo del embed de Scribd, incluyendo todos
 * los <script> con los datos JSON donde están las URLs de imágenes.
 * Idéntico al enfoque de rkwyu/scribd-dl.
 */
async function fetchEmbed(docId) {
    const cookies   = await getScribdCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const url = [
        `https://www.scribd.com/embeds/${docId}/content`,
        `?start_page=1&view_mode=scroll`,
        `&access_key=${SCRIBD_EMBED_KEY}`,
        `&show_recommendations=false`
    ].join('');

    console.log('[SDL] Fetching embed docId:', docId);
    const res = await fetch(url, {
        headers: { ...SCRIBD_HEADERS, Cookie: cookieStr }
    });

    if (!res.ok) throw new Error(`Error al obtener el embed (HTTP ${res.status})`);

    const html = await res.text();
    console.log('[SDL] Embed recibido:', html.length, 'chars');

    if (html.length < 3_000) {
        throw new Error(
            `Respuesta del embed demasiado corta (${html.length} chars). ` +
            'Verifica que estás en la página de un documento válido.'
        );
    }

    return html;
}

// ─── Extracción de URLs de imágenes ───────────────────────────────────────

/**
 * Busca en el HTML completo del embed las URLs de imágenes de página.
 * Normaliza los slashes escapados de JSON (\/) antes de aplicar la regex,
 * igual que rkwyu/scribd-dl para capturar tanto src="" como JSON embebido.
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
 * Descarga imágenes en lotes de 5 en paralelo.
 * Retorna Array de { bytes: Uint8Array, mime: string } | null.
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
                const timer      = setTimeout(() => controller.abort(), 25_000);

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

    console.log(`[SDL] Imágenes OK: ${results.filter(Boolean).length}/${urls.length}`);
    return results;
}

// ─── Construcción de PDF (inline, CSP-safe) ────────────────────────────────

/**
 * Convierte imageData a JPEG si hace falta y construye el PDF.
 * OffscreenCanvas está disponible en service workers de Chrome.
 */
async function buildPdf(imageData, pageDims) {
    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    // Normalizar todas las imágenes a JPEG (el único formato que necesita el PDF builder)
    const jpegPages = await Promise.all(imageData.map(async (item, i) => {
        if (!item) return null;
        let { bytes, mime } = item;

        // WebP y PNG no son JPEG — convertir via OffscreenCanvas
        if (!mime.includes('jpeg') && !mime.includes('jpg')) {
            try {
                bytes = await convertToJpeg(bytes, mime);
            } catch (err) {
                console.warn(`[SDL] Error convirtiendo imagen p${i + 1}:`, err.message);
                return null;
            }
        }
        return { bytes };
    }));

    return buildJpegPdf(jpegPages, pageW, pageH);
}

/**
 * Convierte cualquier formato de imagen a JPEG usando OffscreenCanvas.
 * Disponible en service workers de Chrome — no usa eval ni Function.
 */
async function convertToJpeg(bytes, mime) {
    const blob        = new Blob([bytes], { type: mime });
    const imageBitmap = await createImageBitmap(blob);
    const canvas      = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx         = canvas.getContext('2d');

    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return new Uint8Array(await jpegBlob.arrayBuffer());
}

// ─── Constructor de PDF minimalista ───────────────────────────────────────

/**
 * Construye un PDF válido (PDF 1.4) con imágenes JPEG.
 * Sin librerías externas, sin eval, sin new Function.
 * 100% CSP-safe — puro JavaScript sin APIs restringidas.
 *
 * Estructura de objetos:
 *   1 = Catalog
 *   2 = Pages
 *   Para cada página i:
 *     3 + 3*i = Image XObject (JPEG embebido vía DCTDecode)
 *     4 + 3*i = Content stream (coloca la imagen en el canvas de página)
 *     5 + 3*i = Page dictionary
 */
function buildJpegPdf(pages, pageW, pageH) {
    const enc    = new TextEncoder();
    const chunks = [];
    const objOffsets = {};
    let byteOffset = 0;

    // Acumula un string como bytes
    function str(s) {
        const b = enc.encode(s);
        chunks.push(b);
        byteOffset += b.length;
    }

    // Acumula bytes binarios directamente (para el stream JPEG)
    function bin(b) {
        chunks.push(b);
        byteOffset += b.length;
    }

    // Marca el inicio de un objeto PDF y registra su offset para la xref
    function beginObj(id) {
        objOffsets[id] = byteOffset;
        str(`${id} 0 obj\n`);
    }

    function endObj() {
        str('endobj\n');
    }

    const N          = pages.length;
    const catalogId  = 1;
    const pagesId    = 2;
    const imgId      = i => 3 + 3 * i;
    const contentId  = i => 4 + 3 * i;
    const pageId     = i => 5 + 3 * i;

    // ── Header ──────────────────────────────────────────────────────────────
    // El comentario binario indica a los lectores que el archivo contiene bytes binarios
    str('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    // ── Obj 1: Catalog ──────────────────────────────────────────────────────
    beginObj(catalogId);
    str(`<< /Type /Catalog /Pages ${pagesId} 0 R >>\n`);
    endObj();

    // ── Obj 2: Pages ────────────────────────────────────────────────────────
    const kidsStr = Array.from({ length: N }, (_, i) => `${pageId(i)} 0 R`).join(' ');
    beginObj(pagesId);
    str(`<< /Type /Pages /Count ${N} /Kids [${kidsStr}] >>\n`);
    endObj();

    // ── Objetos por página ──────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
        const page    = pages[i];
        const imgName = `Im${i}`;

        // Obtener dimensiones reales del JPEG (pueden diferir de pageDims)
        let imgW = pageW, imgH = pageH;
        if (page) {
            const dims = readJpegDimensions(page.bytes);
            if (dims) { imgW = dims.width; imgH = dims.height; }
        }

        // Image XObject — DCTDecode es el filtro para JPEG nativo en PDF
        beginObj(imgId(i));
        if (page) {
            const nComp = readJpegComponents(page.bytes) ?? 3;
            const cs    = nComp === 1 ? '/DeviceGray' : '/DeviceRGB';
            str(`<< /Type /XObject /Subtype /Image `);
            str(`/Width ${imgW} /Height ${imgH} `);
            str(`/ColorSpace ${cs} /BitsPerComponent 8 `);
            str(`/Filter /DCTDecode /Length ${page.bytes.length} >>\n`);
            str('stream\n');
            bin(page.bytes);
            str('\nendstream\n');
        } else {
            str('<< >>\n'); // Página faltante: objeto vacío
        }
        endObj();

        // Content stream — instrucciones PDF para escalar y dibujar la imagen
        beginObj(contentId(i));
        const ops = page
            ? enc.encode(`q ${pageW} 0 0 ${pageH} 0 0 cm /${imgName} Do Q`)
            : enc.encode('');
        str(`<< /Length ${ops.length} >>\nstream\n`);
        bin(ops);
        str('\nendstream\n');
        endObj();

        // Page dictionary
        beginObj(pageId(i));
        const res = page
            ? `<< /XObject << /${imgName} ${imgId(i)} 0 R >> >>`
            : '<< >>';
        str(`<< /Type /Page /Parent ${pagesId} 0 R `);
        str(`/MediaBox [0 0 ${pageW} ${pageH}] `);
        str(`/Resources ${res} `);
        str(`/Contents ${contentId(i)} 0 R >>\n`);
        endObj();
    }

    // ── Cross-reference table ───────────────────────────────────────────────
    const xrefOffset = byteOffset;
    const maxId      = 2 + 3 * N; // IDs van del 1 al 2+3N

    str('xref\n');
    str(`0 ${maxId + 1}\n`);
    str('0000000000 65535 f \n'); // Entrada obligatoria para el objeto 0 (libre)

    for (let id = 1; id <= maxId; id++) {
        const off = objOffsets[id] ?? 0;
        str(`${off.toString().padStart(10, '0')} 00000 n \n`);
    }

    // ── Trailer ─────────────────────────────────────────────────────────────
    str(`trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\n`);
    str(`startxref\n${xrefOffset}\n%%EOF\n`);

    // ── Concatenar todos los chunks en un único Uint8Array ──────────────────
    const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0);
    const result     = new Uint8Array(totalBytes);
    let pos = 0;
    for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
    }

    console.log(`[SDL] PDF: ${Math.round(result.length / 1024)} KB | ${N} páginas`);
    return result;
}

// ─── Parseo de cabecera JPEG ───────────────────────────────────────────────

/**
 * Lee width/height del primer marcador SOF0/SOF1/SOF2 del JPEG.
 * Necesario para que el XObject del PDF declare las dimensiones correctas.
 */
function readJpegDimensions(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null; // No es JPEG
    let i = 2;
    while (i < bytes.length - 9) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        // SOF0=C0, SOF1=C1, SOF2=C2 (C4=DHT, no es SOF)
        if (marker >= 0xC0 && marker <= 0xC3) {
            return {
                height: (bytes[i + 5] << 8) | bytes[i + 6],
                width:  (bytes[i + 7] << 8) | bytes[i + 8]
            };
        }
        i += 2 + segLen;
    }
    return null;
}

/**
 * Lee el número de componentes del JPEG (1 = gris, 3 = RGB, 4 = CMYK).
 * Determina el ColorSpace que declara el XObject del PDF.
 */
function readJpegComponents(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i < bytes.length - 9) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xC0 && marker <= 0xC3) {
            return bytes[i + 9]; // Byte de número de componentes en el SOF
        }
        i += 2 + segLen;
    }
    return null;
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

    console.warn('[SDL] Dimensiones no encontradas, usando 902×1167');
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

// ─── Keepalive (evita que el SW se apague durante descargas largas) ────────

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sdl-keepalive') return;
    const interval = setInterval(() => {
        try { port.postMessage('ping'); } catch { clearInterval(interval); }
    }, 20_000);
    port.onDisconnect.addListener(() => clearInterval(interval));
});
