/**
 * Scribd Downloader - Content Script
 * Solo UI — sin lógica de descarga
 */

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

// ─── Renderizado ───────────────────────────────────────────────────────────

function getDocumentId() {
    const match = window.location.href.match(/(?:document|doc|embeds|read|book|presentation)\/(\d+)/);
    return match ? match[1] : null;
}

function renderOverlay() {
    if (document.getElementById('sdl-overlay')) return;
    if (!getDocumentId()) return;

    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

    document.getElementById('sdl-close-btn')
        ?.addEventListener('click', () => document.getElementById('sdl-overlay')?.remove());

    const title  = ScribdUtils.extractTitle();
    const nameEl = document.getElementById('sdl-doc-name');
    if (nameEl && title) {
        nameEl.textContent = title;
        nameEl.title       = title;
    }
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
