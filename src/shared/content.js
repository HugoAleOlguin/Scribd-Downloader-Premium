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
    const READER_SELECTORS = [
        // Reader moderno de Scribd (React)
        '[class*="reader_and_document_bar"]',
        '[class*="outer_page"]',
        '[class*="page_container"]',
        '#book-inner',
        '#book-page-container',
        '.reader_container',
        '.reading_mode',
        '.document_content',
        '.doc_page_container',
        // Fallback genérico: el bloque de contenido principal
        'main article',
        'main',
        '#main-content'
    ];

    let container = null;
    for (const sel of READER_SELECTORS) {
        const el = document.querySelector(sel);
        // Verificar que tenga contenido mínimo (no sea un div vacío)
        if (el && el.innerText.trim().length > 200) {
            container = el;
            console.debug('[SDL] Contenedor encontrado:', sel);
            break;
        }
    }

    if (!container) {
        console.warn('[SDL] No se encontró un contenedor de contenido válido.');
        return null;
    }

    // Clonar para no modificar el DOM original
    const clone = container.cloneNode(true);

    // Hacer absolutas todas las URLs de imágenes relativas
    clone.querySelectorAll('img[src]').forEach(img => {
        try {
            img.src = new URL(img.getAttribute('src'), window.location.origin).href;
        } catch { /* ignorar URLs inválidas */ }
    });

    // Eliminar elementos de UI que no deben ir en el PDF
    const UI_SELECTORS = [
        '[id*="sdl"]', '[class*="sdl"]',          // nuestra propia UI
        '[class*="toolbar"]', '[class*="header"]',  // UI del lector
        '[class*="navigation"]', '[class*="nav"]',
        'nav', 'header', 'footer',
        '[aria-hidden="true"]'
    ];
    UI_SELECTORS.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    const title = ScribdUtils.extractTitle();

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.7;
            color: #111;
            background: #fff;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1, h2, h3 { margin: 1em 0 0.5em; }
        p { margin-bottom: 0.8em; }
        img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
        /* Forzar saltos de página para páginas del lector de Scribd */
        [class*="page"], .outer_page { page-break-after: always; }
    </style>
</head>
<body>
    <h1 style="font-size:18pt; margin-bottom:24px; border-bottom:1px solid #ddd; padding-bottom:12px;">${escapeHtml(title)}</h1>
    ${clone.innerHTML}
</body>
</html>`;
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

        const rawTitle  = ScribdUtils.extractTitle();
        const filename  = ScribdUtils.sanitizeFilename(rawTitle);

        // Intentar capturar HTML del DOM (puede ser null si el reader no está cargado)
        // En ese caso el background usará la Estrategia 1: fetch directo a Scribd
        const htmlContent = captureRenderedContent();
        if (!htmlContent) {
            console.debug('[SDL] DOM vacío: el background usará fetch directo a Scribd');
        }

        if (progressTx) progressTx.textContent = 'Enviando a PDFShift...';

        const response = await sendToBackground({
            action:   'generate_pdf',
            html:     htmlContent,   // puede ser null: background tiene fallback
            url:      window.location.href,
            filename: filename
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
