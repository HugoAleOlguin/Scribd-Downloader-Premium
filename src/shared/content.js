/**
 * Scribd Premium Downloader - Content Script
 * @version 3.1.1
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

// ─── Lógica ────────────────────────────────────────────────────────────────
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

async function handleDownloadClick() {
    if (AppState.isProcessing) return;
    AppState.isProcessing = true;

    const btn        = document.getElementById('sdl-download-btn');
    const progressUI = document.getElementById('sdl-progress-ui');
    const progressTx = document.getElementById('sdl-progress-text');

    try {
        setButtonState(btn, 'loading');
        if (progressUI) progressUI.style.display = 'block';
        if (progressTx) progressTx.textContent   = 'Conectando con el servidor PDF...';
        setStatus('', null);

        const accessKey     = ScribdUtils.extractAccessKey();
        const normalizedUrl = ScribdUtils.normalizeUrl(window.location.href, accessKey);
        const rawTitle      = ScribdUtils.extractTitle();
        const filename      = ScribdUtils.sanitizeFilename(rawTitle);

        console.debug('[SDL] accessKey encontrado:', accessKey ? 'sí (' + accessKey.substring(0, 8) + '...)' : 'no');
        console.debug('[SDL] URL del embed:', normalizedUrl);

        const response = await sendToBackground({
            action:   'generate_pdf',
            url:      normalizedUrl,
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
        idle:    { text: 'Descargar PDF',        disabled: false, cls: '' },
        loading: { text: 'Generando PDF...',      disabled: true,  cls: 'sdl-btn--loading' },
        success: { text: 'Descargado',            disabled: true,  cls: 'sdl-btn--success' }
    };
    const s = states[state] || states.idle;
    btn.disabled   = s.disabled;
    btn.className  = `sdl-btn sdl-btn-primary ${s.cls}`;
    if (label) label.textContent = s.text;
}

function setStatus(message, type) {
    const el = document.getElementById('sdl-status');
    if (!el) return;
    if (!message) { el.style.display = 'none'; return; }
    el.textContent  = message;
    el.className    = `sdl-status sdl-status--${type}`;
    el.style.display = 'block';
}

// ─── Init ─────────────────────────────────────────────────────────────────
(function init() {
    try {
        chrome.storage.local.get(['language'], () => renderOverlay());
    } catch {
        renderOverlay();
    }
})();
