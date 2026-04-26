/**
 * Scribd Downloader - Background Script (Firefox/MV3)
 * @version 5.1.0 (local/develop)
 *
 * Mismo approach que Chrome pero usando browser.* (WebExtensions API).
 * Sin librerías externas — constructor de PDF inline, CSP-safe.
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
        sendProgress('Obteniendo estructura del documento...', 5);
        const embedHtml = await fetchEmbed(docId);

        sendProgress('Analizando páginas...', 15);
        const pageUrls = extractPageImageUrls(embedHtml);

        if (pageUrls.length === 0) {
            return {
                success: false,
                error: 'No se encontraron imágenes. El documento puede requerir sesión activa en Scribd.'
            };
        }

        const pageDims = extractPageDimensions(embedHtml);
        console.log(`[SDL] ${pageDims.width}×${pageDims.height} | ${pageUrls.length} páginas`);

        const cookies   = await getScribdCookies();
        const imageData = await downloadImages(pageUrls, cookies, sendProgress);
        const validCount = imageData.filter(Boolean).length;

        if (validCount === 0) {
            return { success: false, error: 'No se pudo descargar ninguna imagen de página.' };
        }

        sendProgress(`Generando PDF (${validCount} páginas)...`, 85);
        const pdfBytes = await buildPdf(imageData, pageDims);

        sendProgress('Guardando archivo...', 98);
        const blob   = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        const dlId   = await triggerDownload(pdfUrl, `${filename}.pdf`);

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

// ─── Construcción de PDF (inline, CSP-safe) ────────────────────────────────

async function buildPdf(imageData, pageDims) {
    const pageW = pageDims.width  || 902;
    const pageH = pageDims.height || 1167;

    const jpegPages = await Promise.all(imageData.map(async (item, i) => {
        if (!item) return null;
        let { bytes, mime } = item;

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

function buildJpegPdf(pages, pageW, pageH) {
    const enc        = new TextEncoder();
    const chunks     = [];
    const objOffsets = {};
    let byteOffset   = 0;

    function str(s) {
        const b = enc.encode(s);
        chunks.push(b);
        byteOffset += b.length;
    }

    function bin(b) {
        chunks.push(b);
        byteOffset += b.length;
    }

    function beginObj(id) {
        objOffsets[id] = byteOffset;
        str(`${id} 0 obj\n`);
    }

    function endObj() { str('endobj\n'); }

    const N         = pages.length;
    const catalogId = 1;
    const pagesId   = 2;
    const imgId     = i => 3 + 3 * i;
    const contentId = i => 4 + 3 * i;
    const pageId    = i => 5 + 3 * i;

    str('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    beginObj(catalogId);
    str(`<< /Type /Catalog /Pages ${pagesId} 0 R >>\n`);
    endObj();

    const kidsStr = Array.from({ length: N }, (_, i) => `${pageId(i)} 0 R`).join(' ');
    beginObj(pagesId);
    str(`<< /Type /Pages /Count ${N} /Kids [${kidsStr}] >>\n`);
    endObj();

    for (let i = 0; i < N; i++) {
        const page    = pages[i];
        const imgName = `Im${i}`;

        let imgW = pageW, imgH = pageH;
        if (page) {
            const dims = readJpegDimensions(page.bytes);
            if (dims) { imgW = dims.width; imgH = dims.height; }
        }

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
            str('<< >>\n');
        }
        endObj();

        beginObj(contentId(i));
        const ops = page
            ? enc.encode(`q ${pageW} 0 0 ${pageH} 0 0 cm /${imgName} Do Q`)
            : enc.encode('');
        str(`<< /Length ${ops.length} >>\nstream\n`);
        bin(ops);
        str('\nendstream\n');
        endObj();

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

    const xrefOffset = byteOffset;
    const maxId      = 2 + 3 * N;

    str('xref\n');
    str(`0 ${maxId + 1}\n`);
    str('0000000000 65535 f \n');
    for (let id = 1; id <= maxId; id++) {
        const off = objOffsets[id] ?? 0;
        str(`${off.toString().padStart(10, '0')} 00000 n \n`);
    }

    str(`trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\n`);
    str(`startxref\n${xrefOffset}\n%%EOF\n`);

    const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0);
    const result     = new Uint8Array(totalBytes);
    let pos = 0;
    for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }

    console.log(`[SDL] PDF: ${Math.round(result.length / 1024)} KB | ${N} páginas`);
    return result;
}

function readJpegDimensions(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i < bytes.length - 9) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
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

function readJpegComponents(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i < bytes.length - 9) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xC0 && marker <= 0xC3) {
            return bytes[i + 9];
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
