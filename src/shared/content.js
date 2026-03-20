/**
 * Scribd Premium Downloader - Content Script
 * @version 3.1.0
 *
 * RESPONSABILIDADES DE ESTE SCRIPT:
 *   1. Detectar si la página actual es un documento de Scribd válido.
 *   2. Inyectar el overlay con el botón de descarga.
 *   3. Extraer localmente la URL normalizada y el nombre del archivo.
 *   4. Enviar un mensaje al background script para que haga el fetch a la API.
 *      (El fetch DEBE hacerse en background para evitar bloqueos CORS).
 *
 * ScribdUtils está disponible globalmente (cargado antes por el manifest desde services/pdfApi.js).
 */

// ─── Estado mínimo ────────────────────────────────────────────────────────────
const AppState = {
    isProcessing: false
};

// ─── Helpers de mensajería ────────────────────────────────────────────────────
function sendToBackground(message) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, response => resolve(response || {}));
        } catch {
            resolve({ success: false, error: 'Extension context invalidated' });
        }
    });
}

// ─── Overlay HTML ─────────────────────────────────────────────────────────────
const OVERLAY_HTML = `
<div id="sdl-overlay">
    <div class="sdl-card sdl-glass">
        <div class="sdl-header">
            <span class="sdl-brand">📥 Scribd Downloader</span>
            <button class="sdl-close" id="sdl-close-btn" aria-label="Cerrar">×</button>
        </div>
        <div id="sdl-doc-name" class="sdl-doc-name">Detectando documento...</div>
        <div id="sdl-progress-ui" class="sdl-progress-ui" style="display:none;">
            <div class="sdl-progress-track">
                <div id="sdl-progress-fill" class="sdl-progress-fill sdl-progress-indeterminate"></div>
            </div>
            <span id="sdl-progress-text" class="sdl-progress-text">Generando PDF...</span>
        </div>
        <button id="sdl-download-btn" class="sdl-btn sdl-btn-primary sdl-btn-glow">
            <span>⬇ Descargar PDF</span>
            <span class="sdl-badge">Directo</span>
        </button>
        <div id="sdl-status" class="sdl-status"></div>
    </div>
</div>
`;

// ─── Lógica principal ─────────────────────────────────────────────────────────
function getDocumentId() {
    const match = window.location.href.match(/(?:document|doc|embeds|read|book|audiobook)\/(\d+)/);
    return match ? match[1] : null;
}

function renderOverlay() {
    if (document.getElementById('sdl-overlay')) return;
    if (!getDocumentId()) return;

    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

    const closeBtn    = document.getElementById('sdl-close-btn');
    const downloadBtn = document.getElementById('sdl-download-btn');

    closeBtn?.addEventListener('click', () => document.getElementById('sdl-overlay')?.remove());
    downloadBtn?.addEventListener('click', handleDownloadClick);

    // Mostrar el nombre del documento
    const title  = ScribdUtils.extractTitle();
    const nameEl = document.getElementById('sdl-doc-name');
    if (nameEl) {
        nameEl.textContent = title || 'Documento de Scribd';
        nameEl.title       = title || '';
    }
}

async function handleDownloadClick() {
    if (AppState.isProcessing) return;
    AppState.isProcessing = true;

    const btn         = document.getElementById('sdl-download-btn');
    const progressUI  = document.getElementById('sdl-progress-ui');
    const progressTxt = document.getElementById('sdl-progress-text');
    const statusEl    = document.getElementById('sdl-status');

    try {
        // Bloquear UI
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
        if (progressUI)  progressUI.style.display = 'block';
        if (progressTxt) progressTxt.textContent   = 'Enviando al servidor PDF...';
        if (statusEl)    statusEl.textContent       = '';
        statusEl?.setAttribute('class', 'sdl-status');

        // Preparar datos localmente y delegar el fetch al background
        const normalizedUrl = ScribdUtils.normalizeUrl(window.location.href);
        const rawTitle      = ScribdUtils.extractTitle();
        const filename      = ScribdUtils.sanitizeFilename(rawTitle);

        // El background hace el fetch a PDFShift (sin CORS) y descarga el archivo
        const response = await sendToBackground({
            action:   'generate_pdf',
            url:      normalizedUrl,
            filename: filename
        });

        if (!response.success) {
            throw new Error(response.error || 'Error desconocido en el servidor PDF');
        }

        setStatus('¡PDF descargado con éxito! ✓', 'success');

    } catch (error) {
        console.error('[SDL] Error:', error);
        const isTmeout = error.name === 'AbortError' || error.message?.includes('abort');
        setStatus(
            isTmeout
                ? 'Tiempo de espera agotado. Intenta de nuevo.'
                : `Error: ${error.message}`,
            'error'
        );
    } finally {
        AppState.isProcessing = false;
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        setTimeout(() => {
            if (progressUI) progressUI.style.display = 'none';
        }, 3000);
    }
}

function setStatus(message, type = 'info') {
    const el = document.getElementById('sdl-status');
    if (!el) return;
    el.textContent = message;
    el.className   = `sdl-status sdl-status--${type}`;
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
(function init() {
    // Escuchar cambios de idioma (para re-render si se implementa i18n)
    try {
        chrome.storage.local.get(['language'], () => renderOverlay());
    } catch {
        renderOverlay();
    }
})();
