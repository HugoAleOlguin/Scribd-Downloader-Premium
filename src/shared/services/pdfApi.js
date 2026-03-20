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
     * Convierte una URL de documento normal al formato /embeds/ (sin paywall).
     * La API de PDF visita la URL desde sus servidores, así que este formato
     * es el que tiene más probabilidades de mostrar el contenido completo.
     */
    normalizeUrl(url) {
        const match = url.match(SCRIBD_DOCUMENT_REGEX);
        if (match) {
            return `https://www.scribd.com/embeds/${match[3]}/content`;
        }
        return url;
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
