/**
 * Scribd Premium Downloader - Content Script
 * @version 3.0.0
 *
 * Flujo simplificado: un solo botón de descarga directa vía Ploi Cloud API.
 * pdfService está disponible globalmente (cargado antes por el manifest).
 * I18n está disponible globalmente (cargado antes por el manifest).
 */

// ─── Estado mínimo de la aplicación ──────────────────────────────────────────
const AppState = {
    currentDocId:  null,
    isProcessing:  false,
    language:      'es'
};

// ─── Utilidades ───────────────────────────────────────────────────────────────
const Utils = {

    /**
     * Extrae el ID numérico del documento desde la URL actual.
     * Soporta rutas /document/, /embeds/, /read/, /book/, /audiobook/.
     */
    getDocumentId() {
        try {
            const url = window.location.href;
            const match = url.match(/(?:document|doc|embeds|read|book|audiobook)\/(\d+)/);
            if (match) return match[1];

            // Fallback: meta tag de iOS (documenta el ID en URLs de app)
            const iosMeta = document.querySelector('meta[property="al:ios:url"]');
            if (iosMeta) {
                const iosMath = iosMeta.content.match(/scribd:\/\/doc\/(\d+)/);
                if (iosMath) return iosMath[1];
            }
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Envía un mensaje al background script de forma async-safe.
     * Evita excepciones cuando el contexto de la extensión está invalidado.
     */
    sendMessageAsync(msg) {
        return new Promise(resolve => {
            try {
                chrome.runtime.sendMessage(msg, response => resolve(response || {}));
            } catch {
                resolve({ success: false, error: 'Extension context invalidated' });
            }
        });
    }
};

// ─── Interfaz de Usuario ──────────────────────────────────────────────────────
const Interface = {

    /** HTML del overlay centrado. Estilos en overlay.css. */
    overlayHTML: `
        <div id="sdl-overlay">
            <div class="sdl-card sdl-glass">
                <div class="sdl-header">
                    <span class="sdl-brand">📥 Scribd Downloader</span>
                    <button class="sdl-close" id="sdl-close-btn" aria-label="Cerrar">×</button>
                </div>
                <div id="sdl-doc-name" class="sdl-doc-name">Cargando documento...</div>
                <div id="sdl-progress-ui" class="sdl-progress-ui" style="display:none;">
                    <div class="sdl-progress-track">
                        <div id="sdl-progress-fill" class="sdl-progress-fill sdl-progress-indeterminate"></div>
                    </div>
                    <span id="sdl-progress-text" class="sdl-progress-text">Conectando a Ploi Cloud...</span>
                </div>
                <button id="sdl-download-btn" class="sdl-btn sdl-btn-primary sdl-btn-glow">
                    <span>Descargar PDF</span>
                    <span class="sdl-badge">Directo</span>
                </button>
                <div id="sdl-status" class="sdl-status"></div>
            </div>
        </div>
    `,

    /** Inyecta el overlay en el DOM si no existe y hay un doc válido. */
    render() {
        if (document.getElementById('sdl-overlay')) return;

        const docId = Utils.getDocumentId();
        if (!docId) return;

        App.currentDocId = docId;

        // Inserta el HTML y luego adjunta los eventos
        document.body.insertAdjacentHTML('beforeend', this.overlayHTML);
        this.bindEvents();
        this.loadDocName();

        // Observar cambios de idioma en tiempo real
        chrome.storage.onChanged.addListener(changes => {
            if (changes.language) {
                document.getElementById('sdl-overlay')?.remove();
                AppState.language = changes.language.newValue;
                this.render();
            }
        });
    },

    /** Obtiene y muestra el nombre del documento en el overlay. */
    loadDocName() {
        const nameEl = document.getElementById('sdl-doc-name');
        if (!nameEl) return;

        // pdfService ya tiene la lógica de extracción de título
        const title = pdfService.extractTitle();
        nameEl.textContent = title || 'Documento de Scribd';
        nameEl.title       = title || '';
    },

    /** Adjunta listeners a los botones del overlay. */
    bindEvents() {
        const closeBtn    = document.getElementById('sdl-close-btn');
        const downloadBtn = document.getElementById('sdl-download-btn');

        if (closeBtn)    closeBtn.addEventListener('click', () => document.getElementById('sdl-overlay')?.remove());
        if (downloadBtn) downloadBtn.addEventListener('click', () => App.handleDownload());
    },

    /** Muestra u oculta la barra de progreso con un mensaje. */
    setProgress(visible, message = '') {
        const progressUI   = document.getElementById('sdl-progress-ui');
        const progressText = document.getElementById('sdl-progress-text');
        if (progressUI)   progressUI.style.display = visible ? 'block' : 'none';
        if (progressText) progressText.textContent  = message;
    },

    /** Muestra un mensaje de estado (success | error | info). */
    setStatus(message, type = 'info') {
        const statusEl = document.getElementById('sdl-status');
        if (!statusEl) return;
        statusEl.textContent  = message;
        statusEl.className    = `sdl-status sdl-status--${type}`;
    }
};

// ─── Lógica Principal de la App ───────────────────────────────────────────────
const App = {

    currentDocId: null,

    /** Orquesta el flujo completo de descarga: API → blob → background download. */
    async handleDownload() {
        if (AppState.isProcessing) return;
        AppState.isProcessing = true;

        const downloadBtn = document.getElementById('sdl-download-btn');

        try {
            // Bloquear el botón durante el proceso
            if (downloadBtn) {
                downloadBtn.disabled    = true;
                downloadBtn.style.opacity = '0.65';
            }

            Interface.setProgress(true, 'Generando PDF en la nube...');
            Interface.setStatus('');

            // Llama al servicio: normaliza URL, extrae título y llama a Ploi
            const result = await pdfService.download(window.location.href);

            Interface.setProgress(true, 'Guardando archivo...');

            // Delega la descarga al background script para usar chrome.downloads
            // y que el usuario pueda elegir la carpeta de destino
            const downloadUrl = URL.createObjectURL(result.blob);
            const response    = await Utils.sendMessageAsync({
                action:   'trigger_download',
                url:      downloadUrl,
                filename: result.filename
            });

            if (response?.success) {
                Interface.setStatus('¡Descarga exitosa! ✓', 'success');
            } else {
                throw new Error(response?.error || 'Error al iniciar la descarga');
            }

        } catch (error) {
            console.error('[SDL] Error en descarga:', error);

            // Distinguir timeout de otros errores para mensaje más claro
            const isTmeout = error.name === 'AbortError';
            const msg      = isTmeout
                ? 'Tiempo de espera agotado. El servidor tardó demasiado.'
                : `Error: ${error.message}`;

            Interface.setStatus(msg, 'error');

        } finally {
            AppState.isProcessing = false;
            if (downloadBtn) {
                downloadBtn.disabled      = false;
                downloadBtn.style.opacity = '1';
            }
            // Ocultar barra de progreso después de 3 segundos
            setTimeout(() => Interface.setProgress(false), 3000);
        }
    }
};

// ─── Punto de Entrada ─────────────────────────────────────────────────────────
// Carga la preferencia de idioma guardada y luego renderiza el overlay.
(function init() {
    try {
        chrome.storage.local.get(['language'], res => {
            AppState.language = (res && res.language) || 'es';
            Interface.render();
        });
    } catch {
        // Si el contexto de extensión está invalidado, renderizar con fallback
        Interface.render();
    }
})();
