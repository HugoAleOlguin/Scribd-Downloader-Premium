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
     * Scribd incrusta este token en el HTML como parte del estado de la página.
     * Sin él, el endpoint /embeds/ devuelve error HTTP incluso con cookies válidas.
     *
     * Estrategias por orden de fiabilidad:
     *   1. Iframes ya presentes en el DOM con el token en su src.
     *   2. Scripts inline que contienen el JSON de datos del documento.
     *   3. Variables globales de window.
     */
    extractAccessKey() {
        // Intento 1: buscar en iframes del embed (más directo)
        const iframe = document.querySelector('iframe[src*="embeds"][src*="access_key"]');
        if (iframe) {
            try {
                return new URL(iframe.src).searchParams.get('access_key');
            } catch { /* continúa */ }
        }

        // Intento 2: buscar en scripts inline (Scribd incrusta el estado como JSON)
        const scriptPattern = /["']access_key["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/;
        for (const script of document.querySelectorAll('script:not([src])')) {
            const match = script.textContent.match(scriptPattern);
            if (match) return match[1];
        }

        // Intento 3: variables globales conocidas de Scribd
        try {
            const globals = window._scribd_request_params
                || window.scribd_document_options
                || window.pageOptions;
            if (globals?.access_key) return globals.access_key;
        } catch { /* continúa */ }

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
