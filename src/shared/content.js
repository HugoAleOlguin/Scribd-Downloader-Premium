/**
 * Scribd Downloader - Content Script
 * @version 5.0.0 (local/develop)
 *
 * Responsabilidad: mostrar el overlay de descarga y conectar con el background.
 * Sin lógica de captura del DOM — el background maneja todo via embed URL.
 */

const AppState = {
    isProcessing: false
};

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
            <div class="sdl-progress-header">
                <span id="sdl-progress-text" class="sdl-progress-text">Iniciando...</span>
                <span id="sdl-progress-time" class="sdl-progress-time">0s</span>
            </div>
            <div class="sdl-progress-track">
                <div id="sdl-progress-bar" class="sdl-progress-bar"></div>
            </div>
        </div>

        <button id="sdl-download-btn" class="sdl-btn sdl-btn-primary">
            <span class="sdl-btn-label">Descargar PDF</span>
        </button>

        <div id="sdl-status" class="sdl-status" style="display:none;"></div>
    </div>
</div>
`;

// ─── Mensajería con background ─────────────────────────────────────────────

function sendToBackground(message) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, response => resolve(response || {}));
        } catch {
            resolve({ success: false, error: 'Extension context invalidated' });
        }
    });
}

// ─── Renderizado del overlay ───────────────────────────────────────────────

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

    const btn = document.getElementById('sdl-download-btn');

    // Conectar keepalive para evitar que el service worker se apague
    let keepalivePort = null;
    try {
        keepalivePort = chrome.runtime.connect({ name: 'sdl-keepalive' });
    } catch { /* no crítico */ }

    try {
        setButtonState(btn, 'loading');
        setStatus('', null);
        ProgressCtrl.start();

        const filename = ScribdUtils.sanitizeFilename(ScribdUtils.extractTitle());

        const response = await sendToBackground({
            action:   'generate_pdf',
            url:      window.location.href,
            filename: filename
        });

        if (!response.success) {
            throw new Error(response.error || 'Sin respuesta del background');
        }

        ProgressCtrl.complete();
        setStatus('PDF descargado correctamente.', 'success');
        setButtonState(btn, 'success');

    } catch (error) {
        console.error('[SDL]', error);
        ProgressCtrl.hide();
        setStatus(error.message, 'error');
        setButtonState(btn, 'idle');

    } finally {
        AppState.isProcessing = false;
        try { keepalivePort?.disconnect(); } catch { /* ok */ }
        setTimeout(() => ProgressCtrl.hide(), 5000);
    }
}

// ─── Control del botón ─────────────────────────────────────────────────────

function setButtonState(btn, state) {
    if (!btn) return;
    const label = btn.querySelector('.sdl-btn-label');
    const states = {
        idle:    { text: 'Descargar PDF',    disabled: false, cls: '' },
        loading: { text: 'Generando PDF...', disabled: true,  cls: 'sdl-btn--loading' },
        success: { text: 'Descargado ✓',     disabled: true,  cls: 'sdl-btn--success' }
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

// ─── Control de progreso ───────────────────────────────────────────────────

const ProgressCtrl = {
    _startTime: 0,
    _timerInterval: null,

    start() {
        this._startTime = Date.now();
        this._setBar(0);
        this._setText('Iniciando...');
        this._startTimer();
        this.show();
    },

    update(stage, percent) {
        if (percent != null) this._setBar(percent);
        if (stage) this._setText(stage);
    },

    complete() {
        this._stopTimer();
        this._setBar(100);
        this._setText('¡PDF listo!');
    },

    show() {
        const ui = document.getElementById('sdl-progress-ui');
        if (ui) ui.style.display = 'flex';
    },

    hide() {
        this._stopTimer();
        const ui = document.getElementById('sdl-progress-ui');
        if (ui) ui.style.display = 'none';
    },

    _setBar(percent) {
        const p   = Math.min(100, Math.max(0, percent));
        const bar = document.getElementById('sdl-progress-bar');
        if (bar) bar.style.width = p.toFixed(0) + '%';
    },

    _setText(text) {
        const el = document.getElementById('sdl-progress-text');
        if (el) el.textContent = text;
    },

    _startTimer() {
        this._stopTimer();
        const timeEl = document.getElementById('sdl-progress-time');
        this._timerInterval = setInterval(() => {
            if (!timeEl) return;
            const s = Math.floor((Date.now() - this._startTime) / 1000);
            timeEl.textContent = s + 's';
        }, 1000);
    },

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }
};

// Mensajes de progreso desde background.js
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'sdl_progress') {
        ProgressCtrl.update(message.stage || '', message.percent);
    }
});

// ─── Utilidades ────────────────────────────────────────────────────────────

function getDocumentId() {
    const match = window.location.href.match(/(?:document|doc|embeds|read|book|presentation)\/(\d+)/);
    return match ? match[1] : null;
}

// ─── Init ──────────────────────────────────────────────────────────────────

(function init() {
    if (!location.hostname.includes('scribd.com')) return;

    try {
        chrome.storage.local.get(['language'], () => renderOverlay());
    } catch {
        renderOverlay();
    }
})();
