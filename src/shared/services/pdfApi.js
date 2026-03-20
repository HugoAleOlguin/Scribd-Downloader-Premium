/**
 * PDF Download Service - v3.1.0
 *
 * Solo contiene la lógica de EXTRACCIÓN local (título, URL normalizada).
 * El fetch a la API vive en background.js para evitar bloqueos CORS.
 * Content scripts corren en el contexto de la página (scribd.com),
 * por lo que cualquier fetch a dominios externos es bloqueado.
 */

const SCRIBD_DOCUMENT_REGEX =
    /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/(document|doc|presentation)\/(\d+)/;

const ScribdUtils = {

    /**
     * Convierte una URL de documento al formato /embeds/ con access_key.
     * El access_key es un token de sesión generado por Scribd que el servidor
     * de PDFShift necesita para poder cargar el embed sin ser bloqueado.
     */
    normalizeUrl(url, accessKey) {
        const match = url.match(SCRIBD_DOCUMENT_REGEX);
        if (match) {
            const docId = match[3];
            let embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll`;
            if (accessKey) embedUrl += `&access_key=${encodeURIComponent(accessKey)}`;
            return embedUrl;
        }
        return url;
    },

    /**
     * Extrae el access_key de la página de Scribd.
     * El access_key autoriza acceso al embed URL sin necesidad de cookies.
     *
     * Búsqueda en orden de fiabilidad:
     *   1. __NEXT_DATA__ (Next.js serializa todo el estado de la app aquí)
     *   2. Iframes con el embed ya cargado
     *   3. Scripts inline con patrones de texto
     *   4. Variables globales de window
     */
    extractAccessKey() {
        // Intento 1: __NEXT_DATA__ (más fiable — Next.js SSR)
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
            try {
                const nextData = JSON.parse(nextDataEl.textContent);
                const found = deepFindValue(nextData, 'access_key', 10);
                if (found && /^[a-zA-Z0-9_\-]{10,}$/.test(found)) return found;
            } catch { /* continúa */ }
        }

        // Intento 2: iframes con el embed ya cargado
        const iframe = document.querySelector('iframe[src*="embeds"][src*="access_key"]');
        if (iframe) {
            try { return new URL(iframe.src).searchParams.get('access_key'); } catch { /* continúa */ }
        }

        // Intento 3: scripts inline (Scribd incrusta el estado como JSON en varios formatos)
        const KEY_PATTERNS = [
            /"access_key"\s*:\s*"([a-zA-Z0-9_\-]{10,})"/,
            /'access_key'\s*:\s*'([a-zA-Z0-9_\-]{10,})'/,
            /access_key[=:"'\s]+([a-zA-Z0-9_\-]{10,})/
        ];
        for (const script of document.querySelectorAll('script')) {
            const text = script.textContent || '';
            for (const pattern of KEY_PATTERNS) {
                const m = text.match(pattern);
                if (m && m[1]) return m[1];
            }
        }

        // Intento 4: variables globales conocidas de Scribd
        const WINDOW_GLOBALS = ['pageOptions', 'PageOptions', 'scribdApp', '__REDUX_STATE__', 'App'];
        for (const key of WINDOW_GLOBALS) {
            try {
                const obj = window[key];
                const found = deepFindValue(obj, 'access_key', 4);
                if (found && /^[a-zA-Z0-9_\-]{10,}$/.test(found)) return found;
            } catch { /* continúa */ }
        }

        return null;
    },

    /**
     * Extrae el título del documento desde el DOM del cliente.
     * Prioriza selectores específicos antes de caer al title genérico.
     */
    extractTitle() {
        // Intento 1: meta OG title (más fiable que document.title)
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle?.content) {
            return ogTitle.content.replace(/\| Scribd/gi, '').trim();
        }

        // Intento 2: selector específico de Scribd en la vista embed
        const embedTitle = document.querySelector('.title, [data-e2e="doc_page_title"]');
        if (embedTitle?.innerText?.trim()) {
            return embedTitle.innerText.trim();
        }

        // Fallback: title de la pestaña limpiado
        return document.title
            .replace(/\| Scribd/gi, '')
            .replace(/Lea en línea/gi, '')
            .trim() || `scribd_doc_${Date.now()}`;
    },

    /** Limpia el nombre de archivo para que sea válido en cualquier SO. */
    sanitizeFilename(name) {
        return (name || `scribd_doc_${Date.now()}`)
            .replace(/[\/\\:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 150);
    }
};

/**
 * Búsqueda recursiva de un valor por clave en un objeto anidado.
 * Limitada por profundidad para evitar ciclos infinitos o parseo excesivo.
 */
function deepFindValue(obj, key, maxDepth) {
    if (maxDepth <= 0 || obj === null || typeof obj !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'string') {
        return obj[key];
    }
    for (const k of Object.keys(obj)) {
        const result = deepFindValue(obj[k], key, maxDepth - 1);
        if (result !== null) return result;
    }
    return null;
}

