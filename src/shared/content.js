/**
 * Scribd Premium Downloader - Content Script
 * @version 3.3.0
 *
 * ESTRATEGIA: Capturar el HTML ya renderizado en el cliente y enviarlo
 * a PDFShift como contenido HTML (no como URL). Esto evita completamente
 * la detección de bots y restricciones de acceso de Scribd, ya que
 * el contenido ya está en el navegador del usuario.
 */

const AppState = {
    isProcessing: false
};

// ─── Mensajería background ─────────────────────────────────────────────────
function sendToBackground(message) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, response => resolve(response || {}));
        } catch {
            resolve({ success: false, error: 'Extension context invalidated' });
        }
    });
}

// ─── Overlay HTML ──────────────────────────────────────────────────────────
const OVERLAY_HTML = `
<div id="sdl-overlay">
    <div class="sdl-card sdl-glass">

        <div class="sdl-header">
            <div class="sdl-brand-wrap">
                <svg class="sdl-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1.5v9M8 10.5l-3-3M8 10.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2.5 12.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span class="sdl-brand">Scribd Downloader</span>
            </div>
            <button class="sdl-close" id="sdl-close-btn" aria-label="Cerrar">
                <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
        </div>

        <div class="sdl-doc-block">
            <span class="sdl-doc-label">Documento</span>
            <span id="sdl-doc-name" class="sdl-doc-name">Detectando...</span>
        </div>

        <div id="sdl-progress-ui" class="sdl-progress-ui" style="display:none;">
            <div class="sdl-progress-track">
                <div id="sdl-progress-bar" class="sdl-progress-bar"></div>
            </div>
            <span id="sdl-progress-text" class="sdl-progress-text">Generando PDF en el servidor...</span>
        </div>

        <button id="sdl-download-btn" class="sdl-btn sdl-btn-primary">
            <span class="sdl-btn-label">Descargar PDF</span>
            <span class="sdl-badge">API</span>
        </button>

        <div id="sdl-status" class="sdl-status" style="display:none;"></div>
    </div>
</div>
`;

// ─── Captura de contenido del DOM ──────────────────────────────────────────

/**
 * Intenta capturar el contenido del documento ya renderizado por Scribd en el DOM.
 * Si el lector de Scribd renderizó las páginas como HTML, las extraemos aquí
 * y las enviamos a PDFShift como contenido HTML (sin necesidad de que PDFShift
 * acceda a Scribd).
 *
 * Selectores probados en orden de precisión.
 */
function captureRenderedContent() {
    const bodyText = document.body.innerText || '';

    // Detectar paywall
    const paywallCount = (bodyText.match(/Descarga para leer sin publicidad/gi) || []).length;
    if (paywallCount > 3) {
        console.warn('[SDL] Paywall detectado (' + paywallCount + ' páginas bloqueadas).');
        return 'PAYWALL';
    }

    // Intentar aislar el contenido del documento usando <main> o [role="main"].
    // Next.js/React apps ponen aquí el contenido principal, excluyendo header y footer.
    const mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
    let sourceEl  = null;

    if (mainEl && (mainEl.textContent || '').trim().length > 200) {
        sourceEl = mainEl;
        console.log('[SDL] Usando <main> como fuente');
    } else {
        // Fallback: body completo
        sourceEl = document.body;
        console.log('[SDL] Usando <body> como fuente (no se encontró <main>)');
    }

    const clone = sourceEl.cloneNode(true);

    // Remover elementos que definitivamente no son contenido
    ['#sdl-overlay', 'script', 'noscript', 'iframe'].forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Si usamos body y tiene footer visible, quitarlo
    if (sourceEl === document.body) {
        clone.querySelectorAll('footer, [role="contentinfo"]').forEach(el => el.remove());
    }

    const cleanText = (clone.textContent || '').trim();
    console.log('[SDL] Texto capturado:', cleanText.length, 'chars');
    if (cleanText.length < 200) return null;

    // URLs absolutas en imágenes
    clone.querySelectorAll('img[src]').forEach(img => {
        try { img.src = new URL(img.getAttribute('src'), window.location.origin).href; } catch {}
    });

    // Recoger stylesheets de Scribd para que PDFShift aplique print CSS
    const linkTags = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.outerHTML).join('\n');
    const inlineStyles = Array.from(document.head.querySelectorAll('style'))
        .map(s => `<style>${s.textContent}</style>`).join('\n');

    const title = ScribdUtils.extractTitle();
    return {
        html: `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
${linkTags}
${inlineStyles}
<style>
/* Fix: prevenir overflow horizontal (corrido a la derecha) */
html, body { margin: 0 !important; padding: 0 !important;
             overflow-x: hidden !important; max-width: 100% !important; }
* { max-width: 100% !important; box-sizing: border-box !important; }
img { max-width: 100% !important; height: auto !important; }

/* Ocultar UI de Scribd en modo print */
@media print {
    [role="banner"], [role="navigation"], [role="complementary"],
    [role="contentinfo"], [role="dialog"],
    form, input, button, header, footer, nav { display: none !important; }
}
</style>
</head>
<body>${clone.innerHTML}</body></html>`,
        printMode: true
    };
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── UI helpers ────────────────────────────────────────────────────────────
function getDocumentId() {
    const match = window.location.href.match(/(?:document|doc|embeds|read|book|audiobook)\/(\d+)/);
    return match ? match[1] : null;
}

function renderOverlay() {
    if (document.getElementById('sdl-overlay')) return;
    if (!getDocumentId()) return;

    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

    document.getElementById('sdl-close-btn')
        ?.addEventListener('click', () => document.getElementById('sdl-overlay')?.remove());

    document.getElementById('sdl-download-btn')
        ?.addEventListener('click', handleDownloadClick);

    const title  = ScribdUtils.extractTitle();
    const nameEl = document.getElementById('sdl-doc-name');
    if (nameEl && title) {
        nameEl.textContent = title;
        nameEl.title       = title;
    }
}

// ─── Lógica de descarga ────────────────────────────────────────────────────
async function handleDownloadClick() {
    if (AppState.isProcessing) return;
    AppState.isProcessing = true;

    const btn        = document.getElementById('sdl-download-btn');
    const progressUI = document.getElementById('sdl-progress-ui');
    const progressTx = document.getElementById('sdl-progress-text');

    try {
        setButtonState(btn, 'loading');
        if (progressUI) progressUI.style.display = 'block';
        if (progressTx) progressTx.textContent   = 'Capturando contenido del documento...';
        setStatus('', null);

        const rawTitle   = ScribdUtils.extractTitle();
        const filename   = ScribdUtils.sanitizeFilename(rawTitle);

        // ── DIAGNÓSTICO (quitar después de encontrar el problema) ──────────
        const interceptorActivo = document.documentElement.getAttribute('data-sdl-interceptor');
        console.log('[SDL DIAG] Interceptor corrió:', interceptorActivo || 'NO');

        const iframes = document.querySelectorAll('iframe');
        console.log('[SDL DIAG] Iframes en el DOM:', iframes.length);
        iframes.forEach((f, i) => {
            console.log(`[SDL DIAG]   iframe[${i}] src:`, f.getAttribute('src') || f.src || '(vacío)');
        });

        // Loggear las primeras 10 claves de window que empiezan con _ o tienen 'scribd'
        const windowKeys = Object.keys(window)
            .filter(k => k.startsWith('_') || k.toLowerCase().includes('scribd') || k.toLowerCase().includes('page'))
            .slice(0, 15);
        console.log('[SDL DIAG] window globals relevantes:', windowKeys);
        // ────────────────────────────────────────────────────────────────────

        const accessKey  = ScribdUtils.extractAccessKey();
        const htmlContent = captureRenderedContent();

        if (htmlContent === 'PAYWALL') {
            throw new Error(
                'Este documento está bloqueado. Necesitas suscribirte a Scribd o subir '
                + '5 documentos para acceder al contenido.'
            );
        }

        const capturedHtml = htmlContent ? htmlContent.html  : null;
        const printMode    = htmlContent ? htmlContent.printMode : false;

        console.log('[SDL] HTML del DOM:', capturedHtml ? `sí (${capturedHtml.length} chars)` : 'NO encontrado');
        console.log('[SDL] printMode:', printMode);

        if (progressTx) progressTx.textContent = 'Enviando a PDFShift...';

        const response = await sendToBackground({
            action:    'generate_pdf',
            html:      capturedHtml,
            printMode: printMode,
            url:       window.location.href,
            accessKey: accessKey,
            filename:  filename
        });

        if (!response.success) {
            throw new Error(response.error || 'Sin respuesta del servidor');
        }

        setStatus('PDF descargado correctamente.', 'success');
        setButtonState(btn, 'success');

    } catch (error) {
        console.error('[SDL]', error);
        setStatus(error.message, 'error');
        setButtonState(btn, 'idle');

    } finally {
        AppState.isProcessing = false;
        setTimeout(() => {
            if (progressUI) progressUI.style.display = 'none';
        }, 4000);
    }
}

function setButtonState(btn, state) {
    if (!btn) return;
    const label = btn.querySelector('.sdl-btn-label');
    const states = {
        idle:    { text: 'Descargar PDF',   disabled: false, cls: '' },
        loading: { text: 'Generando PDF...', disabled: true,  cls: 'sdl-btn--loading' },
        success: { text: 'Descargado',       disabled: true,  cls: 'sdl-btn--success' }
    };
    const s = states[state] || states.idle;
    btn.disabled  = s.disabled;
    btn.className = `sdl-btn sdl-btn-primary ${s.cls}`;
    if (label) label.textContent = s.text;
}

function setStatus(message, type) {
    const el = document.getElementById('sdl-status');
    if (!el) return;
    if (!message) { el.style.display = 'none'; return; }
    el.textContent   = message;
    el.className     = `sdl-status sdl-status--${type}`;
    el.style.display = 'block';
}

// ─── Init ──────────────────────────────────────────────────────────────────
(function init() {
    try {
        chrome.storage.local.get(['language'], () => renderOverlay());
    } catch {
        renderOverlay();
    }
})();
