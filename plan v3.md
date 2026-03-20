# 🚀 Plan de Implementación: Scribd Premium Downloader v3.0.0

## 1. Resumen Ejecutivo
* **Objetivo Principal:** Reemplazar los métodos de captura de pantalla y renderizado local por una integración directa a la API de Ploi Cloud.
* **Servicio API:** Ploi Cloud Tools (Trial 15 días).
* **Enfoque UX/UI:** Botón único de descarga directa, sin fallbacks confusos, garantizando la máxima simplicidad para el usuario final.
* **Rama de Desarrollo:** `develop`

---

## 2. Auditoría de Código: Estado Actual vs. v3.0.0

### 🗑️ Código a Eliminar (Deprecado)
| Archivo / Librería | Elementos a borrar | Razón |
| :--- | :--- | :--- |
| `src/shared/content.js` | Clase `PDFHandler` completa (líneas ~97-498), `executeHQScan()`, `executeNativeScan()`, y handlers de UI múltiple. | Lógica de scraping obsoleta. |
| `src/shared/background.js` | `injectAutopilot()`, actions `open_external_downloader` y `fetch_image`, y listeners `tabs.onUpdated`. | Ya no se requiere automatización en segundo plano. |
| **Librerías** | `jspdf.umd.min.js`, `html2canvas.min.js` | El PDF se genera en el servidor, no en el cliente. |

### ✏️ Archivos a Modificar
* `src/shared/content.js`: Reducción drástica (de ~833 a ~200 líneas).
* `src/shared/background.js`: Simplificación total a un Service Worker básico (Manifest V3).
* `src/shared/libs/i18n.js`: Limpieza de traducciones no utilizadas.
* `src/shared/overlay.css`: Ajuste de estilos para el nuevo UI simplificado.
* `src/chrome/manifest.json` y `src/firefox/manifest.json`: Actualización de permisos y scripts.
* `build.bat`: Inclusión del nuevo directorio `services`.

---

## 3. Fases de Implementación

### Fase 1: Backup y Limpieza Inicial
Antes de tocar el código, asegura un entorno limpio y elimina las dependencias muertas.
```bash
# 1. Verificar estado limpio
git status

# 2. Eliminar librerías obsoletas
rm src/shared/libs/jspdf.umd.min.js
rm src/shared/libs/html2canvas.min.js

# 3. Commit de inicio de refactorización
git commit -am "chore: v3.0.0 starting refactor and cleanup"
```

### Fase 2: Creación del Servicio API
Crea el nuevo archivo encargado de la comunicación con Ploi Cloud. 
📁 **Nuevo archivo:** `src/shared/services/pdfApi.js`

```javascript
const PDF_API_CONFIG = {
    apiKey: 'V3HFJMSICVIXXE5VLTVSE2YY05GF9IZCOK53DR30KAKAJHU03QA2BLXSC1THN522FPK9I5DL4LVUU4SX',
    endpoint: 'https://api.ploi.io/api/tools/generate-pdf',
    timeout: 90000 // 90 segundos de timeout
};

class PDFDownloadService {
    async download(url, filename) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), PDF_API_CONFIG.timeout);

            const response = await fetch(PDF_API_CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PDF_API_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, name: filename }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(`API Error ${response.status}: ${errData}`);
            }

            const contentType = response.headers.get('content-type') || '';
            const safeFilename = this.sanitizeFilename(filename);
            
            // Si la API devuelve un JSON con la URL del PDF
            if (contentType.includes('application/json')) {
                const data = await response.json();
                const pdfResponse = await fetch(data.url);
                const blob = await pdfResponse.blob();
                return { blob, filename: `${safeFilename}.pdf` };
            }
            
            // Si la API devuelve el Blob directamente
            const blob = await response.blob();
            return { blob, filename: `${safeFilename}.pdf` };

        } catch (error) {
            console.error('[PDF Service] Error:', error);
            throw error;
        }
    }

    sanitizeFilename(name) {
        return (name || `documento_${Date.now()}`)
            .replace(/[\/\\:*?"<>|]/g, '_') // Remueve caracteres inválidos
            .replace(/\s+/g, '_')           // Reemplaza espacios por guiones bajos
            .substring(0, 200);             // Límite de longitud de SO
    }
}

export const pdfService = new PDFDownloadService();
```

### Fase 3: Reescritura de `content.js`
Mantén las funciones de utilidad (`getDocumentId`, `getCleanFilename`) pero simplifica la UI y el flujo de descarga.

📁 **Archivo:** `src/shared/content.js`

```javascript
// --- UI Simplificada ---
const newUI = `
<div id="sdl-overlay">
  <div class="sdl-card">
    <div class="sdl-header">
      <span>📥 Scribd PDF Downloader</span>
      <button class="sdl-close" id="sdl-close-btn">×</button>
    </div>
    <div class="sdl-info">
      <span class="sdl-filename" id="sdl-doc-name">Cargando documento...</span>
    </div>
    <div class="sdl-progress-container" id="sdl-progress-ui" style="display:none;">
      <div class="sdl-progress-bar">
        <div id="sdl-progress-fill" style="width: 0%"></div>
      </div>
      <span id="sdl-progress-text">Conectando con el servidor...</span>
    </div>
    <button id="sdl-download-btn" class="sdl-btn">
      <span>Descargar PDF</span>
      <span class="sdl-badge">Directo</span>
    </button>
    <div id="sdl-status"></div>
  </div>
</div>
`;

// --- Función Principal de Descarga ---
async function handleDownload(docUrl, filename) {
    const btn = document.getElementById('sdl-download-btn');
    const progressUI = document.getElementById('sdl-progress-ui');
    const progressText = document.getElementById('sdl-progress-text');
    
    try {
        btn.disabled = true;
        progressUI.style.display = 'block';
        progressText.innerText = T.connecting || 'Generando PDF en la nube...';
        
        const result = await pdfService.download(docUrl, filename);
        
        progressText.innerText = T.saving || 'Guardando archivo...';
        
        // Ejecuta la descarga mediante la API de Chrome
        chrome.runtime.sendMessage({
            action: 'trigger_download',
            url: URL.createObjectURL(result.blob),
            filename: result.filename
        });

        Interface.showStatus(T.success || '¡Descarga exitosa!', 'success');
        
    } catch (error) {
        Interface.showStatus(`${T.error || 'Error'}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        setTimeout(() => { progressUI.style.display = 'none'; }, 3000);
    }
}
```

### Fase 4: Reescritura de `background.js` (Service Worker MV3)
Este archivo ahora solo actúa como un puente seguro y un service worker eficiente.

📁 **Archivo:** `src/shared/background.js`

```javascript
// Background v3.0.0 - Service Worker Optimizado
importScripts('libs/i18n.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Manejo de la orden de descarga desde content.js
    if (request.action === 'trigger_download') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: true // Permite al usuario elegir dónde guardar
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Error en descarga:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, id: downloadId });
            }
        });
        return true; // Mantiene el canal de mensaje abierto para respuesta asíncrona
    }
    
    sendResponse({ success: true });
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sdl-keepalive') {
        port.onDisconnect.addListener(() => {
            // Lógica de reconexión si el service worker se duerme (opcional en MV3)
        });
    }
});
```

### Fase 5: Actualización de Manifests (Manifest V3)
Ambos manifiestos (Chrome y Firefox) deben reflejar la nueva arquitectura.

📁 **Archivo:** `src/chrome/manifest.json` *(Replicar ajustes en Firefox)*

```json
{
  "manifest_version": 3,
  "name": "Scribd Premium Downloader",
  "version": "3.0.0",
  "description": "Download PDFs from Scribd directly. Powered by Ploi Cloud API.",
  "permissions": [
    "activeTab", 
    "downloads", 
    "storage"
  ],
  "host_permissions": [
    "*://*.scribd.com/*",
    "https://api.ploi.io/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["*://*.scribd.com/*"],
    "js": [
      "libs/shim.js",
      "libs/i18n.js",
      "services/pdfApi.js",
      "content.js"
    ],
    "css": ["overlay.css"],
    "run_at": "document_idle"
  }]
}
```

### Fase 6: Actualización del Script de Compilación
Asegúrate de que el compilador copie la nueva carpeta de servicios.

📁 **Archivo:** `build.bat`

```bat
REM --- Añadir estas líneas donde se copian los archivos compartidos ---
echo Copiando servicios API...
robocopy "%SHARED%\services" "%CHROME_OUT%\services" /e /nfl /ndl /njh /njs >nul
robocopy "%SHARED%\services" "%FIREFOX_OUT%\services" /e /nfl /ndl /njh /njs >nul
```

---

## 4. Estructura de Directorios Final (v3.0.0)

```text
src/
├── shared/
│   ├── content.js              # Refactorizado (~200 líneas)
│   ├── background.js           # Service worker simplificado
│   ├── overlay.css             # UI limpia y minimalista
│   ├── services/
│   │   └── pdfApi.js           # NUEVO: Lógica de la API de Ploi
│   └── libs/
│       ├── i18n.js             # Diccionario actualizado
│       └── shim.js             # Compatibilidad (Mantenido)
├── chrome/
│   └── manifest.json           # Actualizado v3.0.0
├── firefox/
│   └── manifest.json           # Actualizado v3.0.0
└── build.bat                   # Actualizado con robocopy para /services
```

---

## 5. Checklist de Pruebas (QA)

Antes de empaquetar la versión final, verifica:

- [ ] **Instalación:** La extensión carga sin errores en Chrome (`chrome://extensions`) y Firefox (`about:debugging`).
- [ ] **Inyección UI:** El nuevo botón aparece correctamente en las URLs de documentos válidos de Scribd.
- [ ] **Comunicación API:** Al hacer clic, la petición `POST` se envía correctamente a `api.ploi.io` (verificar en la pestaña *Network* de DevTools).
- [ ] **Sanitización:** Un documento llamado `"Mi / Documento : Test"` se guarda como `"Mi___Documento___Test.pdf"`.
- [ ] **Gestión de Errores:** Si apagas el WiFi y haces clic, el UI muestra un mensaje de error claro en lugar de quedarse congelado.
- [ ] **Descarga Nativa:** El archivo se descarga usando el gestor nativo del navegador (`chrome.downloads`), permitiendo al usuario elegir la carpeta destino.
- [ ] **Traducciones:** Al cambiar el idioma del navegador, la interfaz (`T.connecting`, `T.success`) cambia dinámicamente.

---

## 6. Secuencia de Commits Sugerida

Sigue este flujo para mantener un historial de Git limpio y profesional:

```bash
# 1. Agregar el nuevo servicio de API
git add src/shared/services/pdfApi.js build.bat
git commit -m "feat(api): add Ploi Cloud API integration and update build tools"

# 2. Refactorización profunda de scripts
git add src/shared/content.js src/shared/background.js src/shared/overlay.css
git commit -m "refactor(core): remove local rendering and implement direct API download flow"

# 3. Actualización de Manifests y versión
git add src/chrome/manifest.json src/firefox/manifest.json
git commit -m "chore(release): bump version to 3.0.0 and update permissions for Manifest V3"

# 4. Crear Tag de versión
git tag -a v3.0.0 -m "Release Scribd Premium Downloader v3.0.0"

# 5. Push al repositorio
git push origin develop --tags
```

---
¡Excelente actualización! Incorporar la lógica de extracción de `scribd-dl` (regex y parseo del DOM) con la potencia de la API de Ploi Cloud es definitivamente el enfoque más inteligente. Obtienes lo mejor de ambos mundos sin lidiar con el infierno que es empaquetar Puppeteer en una extensión.

Un detalle técnico importante a tener en cuenta: dado que la API de Ploi Cloud visita la URL desde **sus propios servidores**, la limpieza del DOM (`cleanup` de cookies y overlays) que hagamos en el navegador del cliente no afectará el PDF final generado por Ploi. Sin embargo, **la normalización de URLs y la extracción precisa del título son adiciones vitales** que harán que la extensión sea mucho más robusta. He ajustado el UI para asegurar que todo quede bien centrado en la pantalla y no se rompa visualmente.

Aquí tienes el plan de implementación v3.0.0 actualizado, estructurado y listo para copiar y pegar.

---

# 🚀 Plan de Implementación Híbrido: Scribd Premium Downloader v3.0.0

## 1. Resumen Ejecutivo
* **Objetivo:** Integración directa con Ploi Cloud API (generación de PDF) potenciada con la lógica de extracción inteligente de `scribd-dl` (manejo de URLs y títulos).
* **Enfoque:** Botón único, sin fallbacks, con soporte para dominios localizados (es.scribd.com, fr.scribd.com, etc.).
* **Rama:** `develop`

## 2. Lo que Adoptamos de scribd-dl
| Componente | Estado | Uso en la Extensión |
| :--- | :--- | :--- |
| **Regex Expandido** | ✅ UTILIZADO | Soporte para dominios internacionales y diferentes rutas (`/document/`, `/embeds/`). |
| **Extracción de Título** | ✅ UTILIZADO | Parseo del DOM local para obtener el nombre real del archivo antes de enviarlo a la API. |
| **Normalización URL** | ✅ UTILIZADO | Conversión automática a formato `/embeds/` para evitar paywalls en la API. |
| **Puppeteer / pdf-lib** | ❌ DESCARTADO | Reemplazados completamente por la API de Ploi Cloud. |

---

## 3. Fases de Implementación

### Fase 1: Limpieza del Repositorio
Elimina las librerías de generación local que ya no se usarán.
```bash
git rm src/shared/libs/jspdf.umd.min.js
git rm src/shared/libs/html2canvas.min.js
git commit -am "chore: remove legacy local rendering libraries"
```

### Fase 2: El Nuevo Motor Híbrido (`pdfApi.js`)
Este archivo combina tu API Key con la inteligencia de ruteo de `scribd-dl`.

📁 **Archivo:** `src/shared/services/pdfApi.js`

```javascript
/**
 * PDF Download Service - v3.0.0
 * Hybrid Approach: scribd-dl logic + Ploi Cloud API
 */

const SCRIBD_DOMAINS = {
    DOCUMENT: /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/(document|doc|presentation)\/(\d+)/,
    EMBED: /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/embeds\/(\d+)/,
    READ: /^https?:\/\/(www|es|fr|de|pt|it|ko|ja)\.scribd\.com\/(read|book|audiobook)\/(\d+)/
};

const API_CONFIG = {
    endpoint: 'https://api.ploi.io/api/tools/generate-pdf',
    apiKey: 'V3HFJMSICVIXXE5VLTVSE2YY05GF9IZCOK53DR30KAKAJHU03QA2BLXSC1THN522FPK9I5DL4LVUU4SX',
    timeout: 90000
};

class PDFDownloadService {
    
    // Convierte cualquier URL de Scribd al formato Embed (sin paywall visual)
    normalizeUrl(url) {
        const docMatch = url.match(SCRIBD_DOMAINS.DOCUMENT);
        if (docMatch) {
            return `https://www.scribd.com/embeds/${docMatch[3]}/content`;
        }
        return url; // Si ya es embed o no hace match, la devuelve tal cual
    }

    // Extrae el título real desde el DOM del usuario
    extractTitle() {
        const overlay = document.querySelector("div.mobile_overlay a");
        if (overlay?.href) {
            const slug = overlay.href.split('/').pop();
            return decodeURIComponent(slug)?.replace(/-/g, ' ').trim();
        }
        
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle?.content) {
            return ogTitle.content.replace(/\| Scribd/gi, '').trim();
        }
        
        return document.title.replace(/\| Scribd/gi, '').replace(/Lea en línea/gi, '').trim();
    }

    sanitizeFilename(name) {
        return (name || `scribd_doc_${Date.now()}`)
            .replace(/[\/\\:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 150);
    }

    async download(currentUrl) {
        const normalizedUrl = this.normalizeUrl(currentUrl);
        const rawTitle = this.extractTitle();
        const safeFilename = this.sanitizeFilename(rawTitle);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

        try {
            const response = await fetch(API_CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    url: normalizedUrl, 
                    name: safeFilename 
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const contentType = response.headers.get('content-type') || '';
            
            // Si la API devuelve JSON con el link
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (data.url) {
                    const pdfResponse = await fetch(data.url);
                    return { blob: await pdfResponse.blob(), filename: `${safeFilename}.pdf` };
                }
            }
            
            // Si la API devuelve el archivo directo
            return { blob: await response.blob(), filename: `${safeFilename}.pdf` };

        } catch (error) {
            console.error('[PDF Service] Fetch Error:', error);
            throw error;
        }
    }
}

export const pdfService = new PDFDownloadService();
```

### Fase 3: UI y Lógica de Contenido (`content.js`)
Un UI simplificado, centrado en la pantalla (para evitar que quede flotando extrañamente a un costado) y usando el nuevo servicio.

📁 **Archivo:** `src/shared/content.js`

```javascript
// Inyección de UI Centrado
const overlayHTML = `
<div id="sdl-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); z-index: 999999;">
  <div class="sdl-card" style="background: white; padding: 24px; border-radius: 12px; min-width: 300px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
    <div class="sdl-header" style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 15px;">
      <span>📥 Scribd Downloader</span>
      <button id="sdl-close-btn" style="border:none; background:none; cursor:pointer; font-size:18px;">×</button>
    </div>
    <div id="sdl-doc-name" style="color: #666; margin-bottom: 20px; font-size: 14px; word-break: break-all;">
      Cargando info...
    </div>
    <div id="sdl-progress-ui" style="display:none; margin-bottom: 15px;">
      <span id="sdl-progress-text" style="font-size: 13px; color: #007bff;">Conectando a Ploi Cloud...</span>
    </div>
    <button id="sdl-download-btn" style="background: #1e88e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold;">
      Descargar PDF
    </button>
    <div id="sdl-status" style="margin-top: 10px; font-size: 12px;"></div>
  </div>
</div>
`;

// Lógica de Descarga
async function initDownload() {
    const btn = document.getElementById('sdl-download-btn');
    const progressUI = document.getElementById('sdl-progress-ui');
    const statusText = document.getElementById('sdl-status');
    
    try {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        progressUI.style.display = 'block';
        statusText.innerText = '';
        
        // El servicio ya se encarga de extraer el título y normalizar la URL localmente
        const result = await pdfService.download(window.location.href);
        
        document.getElementById('sdl-progress-text').innerText = 'Guardando archivo...';
        
        // Enviar al background script para descarga nativa
        chrome.runtime.sendMessage({
            action: 'trigger_download',
            url: URL.createObjectURL(result.blob),
            filename: result.filename
        });

        statusText.style.color = 'green';
        statusText.innerText = '¡Descarga exitosa!';
        
    } catch (error) {
        statusText.style.color = 'red';
        statusText.innerText = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        setTimeout(() => { progressUI.style.display = 'none'; }, 3000);
    }
}
```

### Fase 4: Service Worker (`background.js`)
Manejo de descargas nativas (Manifest V3).

📁 **Archivo:** `src/shared/background.js`

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'trigger_download') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: true 
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, id: downloadId });
            }
        });
        return true; 
    }
});
```

### Fase 5: Actualización de Manifests
Asegúrate de incluir los permisos de los múltiples dominios localizados que añadimos en la regex.

📁 **Archivo:** `src/chrome/manifest.json` *(Replicar en Firefox)*

```json
{
  "manifest_version": 3,
  "name": "Scribd Premium Downloader",
  "version": "3.0.0",
  "permissions": ["activeTab", "downloads", "storage"],
  "host_permissions": [
    "*://*.scribd.com/*",
    "https://api.ploi.io/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": [
      "*://*.scribd.com/*"
    ],
    "js": [
      "services/pdfApi.js",
      "content.js"
    ],
    "run_at": "document_idle"
  }]
}
```

---

## 4. Próximos Pasos (Commits)

```bash
git add src/shared/services/pdfApi.js
git commit -m "feat(api): implement hybrid engine with Ploi Cloud API and scribd-dl regex/extractors"

git add src/shared/content.js src/shared/background.js
git commit -m "refactor(ui): apply centered UI and native background downloading"

git add src/chrome/manifest.json src/firefox/manifest.json
git commit -m "chore(release): bump to 3.0.0 with extended localized domain support"
```