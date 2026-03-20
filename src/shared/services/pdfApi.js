/**
 * PDF Download Service - v3.0.0
 * Motor Híbrido: regex/extractores de scribd-dl + generación en la nube de Ploi API.
 *
 * La API de Ploi visita la URL desde sus propios servidores,
 * así que la normalización local a /embeds/ es clave para evitar el paywall.
 */

const SCRIBD_DOMAINS = {
    DOCUMENT: /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/(document|doc|presentation)\/(\d+)/,
    EMBED:    /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/embeds\/(\d+)/,
    READ:     /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/(read|book|audiobook)\/(\d+)/
};

const API_CONFIG = {
    // Endpoint correcto de la Tools API de Ploi Cloud (distinto al de gestión de servidores api.ploi.io)
    endpoint: 'https://ploi.cloud/api/v1/tools/pdf/convert/url',
    apiKey:   'V3HFJMSICVIXXE5VLTVSE2YY05GF9IZCOK53DR30KAKAJHU03QA2BLXSC1THN522FPK9I5DL4LVUU4SX',
    timeout:  90000 // 90 segundos: la generación de PDF en la nube puede tardar
};

class PDFDownloadService {

    /**
     * Convierte cualquier URL de Scribd al formato /embeds/ (sin paywall visual).
     * La API de Ploi accede desde sus servidores, por lo que la URL normalizada
     * es la que determina si puede ver el contenido completo.
     */
    normalizeUrl(url) {
        const docMatch = url.match(SCRIBD_DOMAINS.DOCUMENT);
        if (docMatch) {
            return `https://www.scribd.com/embeds/${docMatch[3]}/content`;
        }
        // Si ya es embed o no hace match, se devuelve sin cambios
        return url;
    }

    /**
     * Extrae el título real del documento desde el DOM del usuario.
     * Prioriza selectores específicos antes de caer al title genérico.
     */
    extractTitle() {
        // Intento 1: el enlace del overlay mobile tiene el slug limpio
        const overlay = document.querySelector('div.mobile_overlay a');
        if (overlay?.href) {
            const slug = overlay.href.split('/').pop();
            return decodeURIComponent(slug)?.replace(/-/g, ' ').trim();
        }

        // Intento 2: meta OG title (más fiable que document.title)
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle?.content) {
            return ogTitle.content.replace(/\| Scribd/gi, '').trim();
        }

        // Fallback: limpieza básica del título de la pestaña
        return document.title
            .replace(/\| Scribd/gi, '')
            .replace(/Lea en línea/gi, '')
            .trim();
    }

    /**
     * Limpia el nombre de archivo eliminando caracteres inválidos en SO.
     */
    sanitizeFilename(name) {
        return (name || `scribd_doc_${Date.now()}`)
            .replace(/[\/\\:*?"<>|]/g, '_') // Caracteres inválidos en Windows/macOS/Linux
            .replace(/\s+/g, '_')
            .substring(0, 150); // Límite seguro para la mayoría de sistemas de archivos
    }

    /**
     * Flujo principal: normaliza URL, extrae título, llama a Ploi y devuelve el blob.
     * Soporta tanto respuesta JSON (con URL del PDF) como blob directo.
     */
    async download(currentUrl) {
        const normalizedUrl = this.normalizeUrl(currentUrl);
        const rawTitle      = this.extractTitle();
        const safeFilename  = this.sanitizeFilename(rawTitle);

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), API_CONFIG.timeout);

        try {
            const response = await fetch(API_CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.apiKey}`,
                    'Content-Type':  'application/json'
                },
                // La API de Ploi Cloud solo acepta el campo "url"
                // El nombre de archivo lo ponemos nosotros al guardar
                body:   JSON.stringify({ url: normalizedUrl }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            const contentType = response.headers.get('content-type') || '';

            // Caso A: la API devuelve un JSON con la URL del PDF generado (ej: { url: "https://..." })
            if (contentType.includes('application/json')) {
                const data = await response.json();
                // Ploi Cloud devuelve { url: "..." } apuntando al PDF generado
                const pdfUrl = data.url || data.pdf_url || data.download_url;
                if (pdfUrl) {
                    const pdfResponse = await fetch(pdfUrl);
                    return { blob: await pdfResponse.blob(), filename: `${safeFilename}.pdf` };
                }
                throw new Error(`API respondió con JSON pero sin URL de descarga: ${JSON.stringify(data)}`);
            }

            // Caso B: la API devuelve el archivo PDF directamente como binario
            return { blob: await response.blob(), filename: `${safeFilename}.pdf` };

        } catch (error) {
            console.error('[PDF Service] Error en fetch:', error);
            throw error;
        }
    }
}

// Instancia singleton exportada que usan content.js y otros modules
const pdfService = new PDFDownloadService();
