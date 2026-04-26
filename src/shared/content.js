/**
 * content.js — Scribd Downloader
 * Renderiza el overlay en páginas de Scribd.
 */

const OVERLAY_HTML = `
<div id="sdl-overlay">
    <div class="sdl-card">

        <div class="sdl-header">
            <span class="sdl-brand">Scribd Downloader</span>
            <button id="sdl-close" aria-label="Cerrar">✕</button>
        </div>

        <div class="sdl-doc-name" id="sdl-doc-name">Detectando...</div>

        <button id="sdl-download-btn" class="sdl-btn">
            Descargar PDF
        </button>

        <div id="sdl-status" style="display:none;"></div>
    </div>
</div>
`;

function getDocId() {
    const m = location.href.match(/(?:document|doc|read|presentation)\/(\d+)/);
    return m ? m[1] : null;
}

function getTitle() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content) return og.content.replace(/\| Scribd/gi, '').trim();
    return document.title.replace(/\| Scribd/gi, '').trim() || `doc_${Date.now()}`;
}

function render() {
    if (document.getElementById('sdl-overlay')) return;
    if (!getDocId()) return;

    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

    document.getElementById('sdl-doc-name').textContent = getTitle();

    document.getElementById('sdl-close').addEventListener('click', () => {
        document.getElementById('sdl-overlay')?.remove();
    });
}

render();
