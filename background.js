/**
 * Scribd Premium Downloader
 * Background Service Worker with i18n
 * @version 2.4.0
 */

// I18n Data (Copy-Pasted because importScripts is tricky in some contexts without build step)
// NOTE: Ideally, use importScripts('libs/i18n.js') if manifest supports it properly, 
// but direct embedding is safer for single-file service workers without bundlers.

const I18n = {
    es: {
        toast: {
            init: { title: "Iniciando", desc: "Conectando al servidor..." },
            verify: { title: "Verificación de Seguridad", desc: "Resolviendo protección Cloudflare..." },
            verify_done: { title: "Verificación Completada", desc: "Accediendo al documento..." },
            wait: { title: "Generando Enlace de Descarga", desc: "Sincronizando con servidor externo..." },
            redirect: { title: "Redirigiendo", desc: "Entrando a la fase final de descarga..." },
            analyzing: { title: "Analizando Documento", desc: "Localizando el flujo de datos del PDF..." },
            validating: { title: "Verificando Integridad", desc: "Comprobando tamaño y formato del archivo..." },
            success: { title: "¡Documento Validado!", desc: "La descarga ha comenzado." },
            error_damaged: { title: "Archivo No Disponible", desc: "El PDF está vacío o dañado.", help: "<b>Descarga Fallida:</b><br/>El archivo PDF original no está disponible o está dañado en el servidor externo. <br/><br/>👉 <b>Solución:</b> Cierra esta pestaña y usa la opción <b>'Escaneo HQ'</b> en el panel de la extensión. Este método alternativo funciona en casi todos los documentos." },
            error_timeout: { title: "Tiempo de Espera Agotado", desc: "El servidor externo no respondió. Inténtalo de nuevo en unos minutos." },
            direct: { title: "Acceso Directo", desc: "Saltando verificación..." },
            error_detected: { title: "Error Detectado", desc: "El visualizador indica un fallo en el archivo." }
        }
    },
    en: {
        toast: {
            init: { title: "Starting", desc: "Connecting to server..." },
            verify: { title: "Security Verification", desc: "Solving Cloudflare protection..." },
            verify_done: { title: "Verification Complete", desc: "Accessing document..." },
            wait: { title: "Generating Download Link", desc: "Synchronizing with external server..." },
            redirect: { title: "Redirecting", desc: "Entering final download phase..." },
            analyzing: { title: "Analyzing Document", desc: "Locating PDF data stream..." },
            validating: { title: "Verifying Integrity", desc: "Checking file size and format..." },
            success: { title: "Document Validated!", desc: "Download has started." },
            error_damaged: { title: "File Unavailable", desc: "PDF is empty or corrupt.", help: "<b>Download Failed:</b><br/>The original PDF file is not available or is corrupted on the external server. <br/><br/>👉 <b>Solution:</b> Close this tab and use the <b>'Smart Scan (HQ)'</b> option in the extension panel. This alternative method works on almost all documents." },
            error_timeout: { title: "Request Timed Out", desc: "The external server did not respond. Try again in a few minutes." },
            direct: { title: "Direct Access", desc: "Skipping verification..." },
            error_detected: { title: "Error Detected", desc: "Viewer indicates a failure in the file." }
        }
    }
};

const StateManager = {
    get: async () => {
        try {
            const result = await chrome.storage.local.get(['automationState', 'language']);
            const state = result.automationState || { tabId: null, docUrl: null, active: false };
            const lang = result.language || 'es';
            return { ...state, language: lang };
        } catch (e) {
            return { tabId: null, docUrl: null, active: false, language: 'es' };
        }
    },
    set: async (state) => {
        await chrome.storage.local.set({ automationState: state });
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "capture_tab") {
        // Firefox requires explicit windowId — get it from the active tab query
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const windowId = tabs[0]?.windowId;
            if (!windowId) {
                sendResponse({ success: false, error: 'No active window found' });
                return;
            }
            chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, image: dataUrl });
                }
            });
        });
        return true;
    }

    if (request.action === "fetch_image") {
        fetch(request.url).then(r => r.blob()).then(blob => { const reader = new FileReader(); reader.onloadend = () => sendResponse({ success: true, data: reader.result }); reader.readAsDataURL(blob); }).catch(e => sendResponse({ success: false, error: e.message })); return true;
    }

    if (request.action === "validate_download") {
        fetch(request.url, { method: 'HEAD' })
            .then(response => {
                const type = response.headers.get('content-type');
                const length = response.headers.get('content-length');
                const size = length ? parseInt(length) : null;

                // Firefox may omit content-length due to CORS — if so, trust content-type alone
                const isValidType = type && (type.includes('pdf') || type.includes('octet') || type.includes('force-download'));
                const isValidSize = size === null ? true : size > 2048; // If no size header, skip size check

                if (response.ok && (isValidType || size === null)) {
                    const rawName = request.docName || 'Scribd_Document_Premium';
                    const safeFilename = rawName.replace(/[^a-z0-9\s\-_\u00C0-\u00FF]/gi, '').trim().replace(/\s+/g, '_') || 'Scribd_Document_Premium';
                    chrome.downloads.download({ url: request.url, filename: `${safeFilename}.pdf`, saveAs: true });
                    sendResponse({ valid: true });
                } else {
                    sendResponse({ valid: false, reason: `Invalid: type=${type}, size=${size}` });
                }
            }).catch(err => sendResponse({ valid: false, reason: `Network Error: ${err.message}` }));
        return true;
    }

    if (request.action === "open_external_downloader") {
        const targetUrl = "https://scribd.vdownloaders.com/";
        chrome.tabs.create({ url: targetUrl }, async (newTab) => {
            // Guardar también el nombre del documento para usarlo al descargar
            await StateManager.set({ docUrl: request.docUrl, docName: request.docName || '', active: true, tabId: newTab.id });
            sendResponse({ success: true });
        });
        return true;
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        const state = await StateManager.get();
        if (state.active && tabId === state.tabId) {

            // Pass language to injected script
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (urlToPaste, langCode, Translations, docName) => {
                    const currentUrl = window.location.href;
                    const T = Translations[langCode]?.toast || Translations['es'].toast;

                    const updateStatusUI = (step, title, status, type = "info", customHelp = null) => {
                        let container = document.getElementById('spd-ui-root');
                        if (!container) {
                            const style = document.createElement('style');
                            style.innerHTML = `#spd-ui-root { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; width: 380px; pointer-events: none; } .spd-toast { pointer-events: auto; background: rgba(20, 20, 24, 0.98); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); color: #fff; animation: spd-slide 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: start; gap: 14px; position: relative; } .spd-icon { font-size: 22px; line-height: 1; margin-top: 2px; } .spd-content { flex: 1; } .spd-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; display: block; letter-spacing: -0.01em; } .spd-status { font-size: 13px; opacity: 0.85; line-height: 1.4; color: #a1a1aa; font-weight: 500; } .spd-progress { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 12px; overflow: hidden; } .spd-bar { height: 100%; background: #00e676; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(0, 230, 118, 0.5); } .spd-help { margin-top: 12px; font-size: 12px; background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); padding: 10px; border-radius: 6px; color: #ff8a80; line-height: 1.4; display: block;} .spd-close { position: absolute; top: 8px; right: 8px; background: transparent; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 16px; line-height: 1; padding: 4px; } .spd-close:hover { color: #fff; } @keyframes spd-slide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
                            document.head.appendChild(style);
                            container = document.createElement('div');
                            container.id = 'spd-ui-root';
                            document.body.appendChild(container);
                        }

                        const config = { info: { color: "#3b82f6", icon: "💎" }, wait: { color: "#f59e0b", icon: "⏳" }, success: { color: "#10b981", icon: "✨" }, error: { color: "#ef4444", icon: "⚠️" } };
                        const c = config[type] || config.info;
                        const pct = Math.min(100, (step / 4) * 100);

                        container.innerHTML = `
                            <div class="spd-toast">
                                <button class="spd-close" onclick="document.getElementById('spd-ui-root').remove()">×</button>
                                <div class="spd-icon">${c.icon}</div>
                                <div class="spd-content">
                                    <span class="spd-title" style="color:${c.color}">${title}</span>
                                    <div class="spd-status">${status}</div>
                                    ${type !== 'error' ? `<div class="spd-progress"><div class="spd-bar" style="width: ${pct}%"></div></div>` : ''}
                                    ${type === 'error' ? `<div class="spd-help">${customHelp || T.error_damaged.help}</div>` : ''}
                                </div>
                            </div>
                        `;
                    };

                    function getFrameElement(win) {
                        try { return win.frameElement; } catch (e) { return null; }
                    }

                    if (currentUrl.includes('ilide.info')) {
                        updateStatusUI(3, T.analyzing.title, T.analyzing.desc, "wait");
                        let attempts = 0; let found = false;
                        const checkIframe = setInterval(() => {
                            if (found) { clearInterval(checkIframe); return; }
                            attempts++;

                            const viewerFrame = document.querySelector('iframe[src*="viewer.html"]');
                            const errorWrapper = document.querySelector('#errorContainer');

                            if (errorWrapper && errorWrapper.offsetParent !== null) {
                                clearInterval(checkIframe); found = true;
                                updateStatusUI(4, T.error_detected.title, T.error_detected.desc, "error");
                                return;
                            }

                            if (viewerFrame) {
                                try {
                                    const urlParam = new URL(viewerFrame.src).searchParams.get('file');
                                    if (urlParam) {
                                        found = true; clearInterval(checkIframe);
                                        const directPdfUrl = decodeURIComponent(urlParam);
                                        updateStatusUI(3, T.validating.title, T.validating.desc, "wait");
                                        chrome.runtime.sendMessage({ action: "validate_download", url: directPdfUrl, docName: docName }, (r) => {
                                            if (r && r.valid) { updateStatusUI(4, T.success.title, T.success.desc, "success"); }
                                            else { updateStatusUI(4, T.error_damaged.title, T.error_damaged.desc, "error", T.error_damaged.help); }
                                        });
                                        return;
                                    }
                                } catch (e) { }
                            }
                            if (attempts > 30) { clearInterval(checkIframe); if (!found) updateStatusUI(4, T.error_timeout.title, T.error_timeout.desc, "error", T.error_damaged.help); }
                        }, 1000);
                        return;
                    }

                    const bodyText = document.body.innerText || "";
                    const isWaitPage = bodyText.includes('Please wait a moment') || bodyText.includes('ready in');
                    const finalLink = document.getElementById('btn-download');

                    if (isWaitPage || (finalLink && finalLink.href && finalLink.href.includes('ilide'))) {
                        updateStatusUI(3, T.wait.title, T.wait.desc, "wait");
                        const checkTimer = setInterval(() => {
                            const link = document.getElementById('btn-download');
                            if (link && link.href && link.href.includes('ilide')) {
                                clearInterval(checkTimer);
                                updateStatusUI(3, T.redirect.title, T.redirect.desc, "success");
                                link.target = "_self"; link.removeAttribute('rel'); window.location.href = link.href;
                            }
                        }, 500);
                        return;
                    }

                    const input = document.getElementById('url') || document.querySelector('input[name="url"]');
                    const stage1Btn = document.querySelector('button[type="submit"].btn-primary');

                    if (input && stage1Btn && !document.querySelector('.cf-turnstile')) {
                        updateStatusUI(1, T.init.title, T.init.desc, "info");
                        setTimeout(() => {
                            input.focus(); input.click();
                            try { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, urlToPaste); } catch (e) { input.value = urlToPaste; }
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            setTimeout(() => stage1Btn.click(), 500);
                        }, 800);
                        return;
                    }

                    const downloadBtn = document.querySelector('button.btn-primary');
                    const cloudflareBox = document.querySelector('.cf-turnstile');

                    if (downloadBtn && !input) {
                        if (cloudflareBox && cloudflareBox.offsetParent !== null) {
                            updateStatusUI(2, T.verify.title, T.verify.desc, "wait");
                            const checkLoop = setInterval(() => {
                                const responseInput = document.querySelector('[name="cf-turnstile-response"]');
                                if (responseInput && responseInput.value) { clearInterval(checkLoop); updateStatusUI(2, T.verify_done.title, T.verify_done.desc, "success"); setTimeout(() => downloadBtn.click(), 500); }
                            }, 800);
                        } else {
                            updateStatusUI(2, T.direct.title, T.direct.desc, "success");
                            setTimeout(() => downloadBtn.click(), 1000);
                        }
                    }
                },
                args: [state.docUrl, state.language, I18n, state.docName || '']
            });
        }
    }
});
