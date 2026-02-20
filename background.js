/**
 * Scribd Premium Downloader
 * Background Service Worker
 * @version 2.3.0
 */

let automationState = { tabId: null, docUrl: null, active: false };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // --- UTILS ---
    if (request.action === "capture_tab") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            sendResponse({ success: !chrome.runtime.lastError, image: dataUrl });
        });
        return true;
    }

    if (request.action === "fetch_image") {
        fetch(request.url).then(r => r.blob()).then(blob => { const reader = new FileReader(); reader.onloadend = () => sendResponse({ success: true, data: reader.result }); reader.readAsDataURL(blob); }).catch(e => sendResponse({ success: false, error: e.message })); return true;
    }

    // --- DOWNLOAD VALIDATOR (New v2.3) ---
    if (request.action === "validate_download") {
        fetch(request.url, { method: 'HEAD' })
            .then(response => {
                const type = response.headers.get('content-type');
                const length = response.headers.get('content-length');
                const size = length ? parseInt(length) : 0;

                // Rules: Must be PDF and > 2KB (Empty PDFs are usually ~1KB headers)
                // Note: vDownloaders sometimes returns 'application/octet-stream' or 'binary/octet-stream'
                const isValidType = type && (type.includes('pdf') || type.includes('octet'));
                const isValidSize = size > 2048;

                if (response.ok && isValidSize) {
                    // Trigger native download to ensure file saving
                    chrome.downloads.download({
                        url: request.url,
                        filename: "Scribd_Document_Premium.pdf",
                        saveAs: true // Let user choose location, safer
                    });
                    sendResponse({ valid: true });
                } else {
                    sendResponse({ valid: false, reason: "File too small or invalid type" });
                }
            })
            .catch(error => {
                sendResponse({ valid: false, reason: "Network Error" });
            });
        return true; // Async response
    }

    // --- BRIDGE START ---
    if (request.action === "open_external_downloader") {
        const targetUrl = "https://scribd.vdownloaders.com/";
        automationState = { docUrl: request.docUrl, active: true, tabId: null };
        chrome.tabs.create({ url: targetUrl }, (newTab) => {
            automationState.tabId = newTab.id;
            sendResponse({ success: true });
        });
        return true;
    }
});

// --- AUTOMATION BRAIN ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (automationState.active && tabId === automationState.tabId && changeInfo.status === 'complete') {

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (urlToPaste) => {
                const currentUrl = window.location.href;

                // UI Renderer (Toast System)
                const updateStatusUI = (step, title, status, type = "info") => {
                    let container = document.getElementById('spd-ui-root');
                    if (!container) {
                        const style = document.createElement('style');
                        style.innerHTML = `
                            #spd-ui-root { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; width: 380px; pointer-events: none; }
                            .spd-toast { pointer-events: auto; background: rgba(20, 20, 24, 0.98); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); color: #fff; animation: spd-slide 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: start; gap: 14px; position: relative; }
                            .spd-icon { font-size: 22px; line-height: 1; margin-top: 2px; }
                            .spd-content { flex: 1; }
                            .spd-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; display: block; letter-spacing: -0.01em; }
                            .spd-status { font-size: 13px; opacity: 0.85; line-height: 1.4; color: #a1a1aa; font-weight: 500; }
                            .spd-progress { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 12px; overflow: hidden; }
                            .spd-bar { height: 100%; background: #00e676; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(0, 230, 118, 0.5); }
                            .spd-help { margin-top: 12px; font-size: 12px; background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); padding: 10px; border-radius: 6px; color: #ff8a80; line-height: 1.4; display: block;}
                            .spd-close { position: absolute; top: 8px; right: 8px; background: transparent; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 16px; line-height: 1; padding: 4px; }
                            .spd-close:hover { color: #fff; }
                            @keyframes spd-slide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                        `;
                        document.head.appendChild(style);
                        container = document.createElement('div');
                        container.id = 'spd-ui-root';
                        document.body.appendChild(container);
                    }

                    const config = {
                        info: { color: "#3b82f6", icon: "💎" },
                        wait: { color: "#f59e0b", icon: "⏳" },
                        success: { color: "#10b981", icon: "✨" },
                        error: { color: "#ef4444", icon: "⚠️" }
                    };
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
                                ${type === 'error' ? `<div class="spd-help"><b>Descarga Fallida:</b><br/>El archivo PDF original no está disponible o está dañado. <br/><br/>👉 <b>Solución:</b> Cierra esta pestaña y usa la opción <b>"Escaneo HQ"</b> en la extensión.</div>` : ''}
                            </div>
                        </div>
                    `;
                };

                // --- STAGE 4: ILIDE (Validation Logic) ---
                if (currentUrl.includes('ilide.info')) {
                    updateStatusUI(3, "Analizando Documento", "Buscando flujo de datos...", "wait");

                    let attempts = 0;
                    let found = false;

                    const checkIframe = setInterval(() => {
                        if (found) { clearInterval(checkIframe); return; }

                        attempts++;
                        const viewerFrame = document.querySelector('iframe[src*="viewer.html"]');

                        // Scenario 1: Red Error Bar already visible in DOM
                        const errorBar = document.querySelector('#errorContainer') || (viewerFrame && viewerFrame.contentDocument && viewerFrame.contentDocument.querySelector('#errorWrapper'));
                        if (errorBar && errorBar.offsetParent !== null) {
                            clearInterval(checkIframe);
                            found = true;
                            updateStatusUI(4, "Error Detectado", "El visualizador indica un fallo.", "error");
                            return;
                        }

                        if (viewerFrame) {
                            try {
                                const urlParam = new URL(viewerFrame.src).searchParams.get('file');
                                if (urlParam) {
                                    found = true;
                                    clearInterval(checkIframe);

                                    const directPdfUrl = decodeURIComponent(urlParam);

                                    // NEW: Validate before download
                                    updateStatusUI(3, "Verificando Integridad", "Comprobando tamaño del archivo...", "wait");

                                    chrome.runtime.sendMessage({ action: "validate_download", url: directPdfUrl }, (response) => {
                                        if (response && response.valid) {
                                            updateStatusUI(4, "¡Documento Validado!", "Descarga iniciada.", "success");
                                        } else {
                                            console.error("Validation Failed:", response);
                                            updateStatusUI(4, "Archivo Dañado", "El PDF está vacío o corrupto.", "error");
                                        }
                                    });
                                    return;
                                }
                            } catch (e) { }
                        }

                        if (attempts > 30) {
                            clearInterval(checkIframe);
                            if (!found) {
                                updateStatusUI(4, "Tiempo Agotado", "El servidor no entregó el documento.", "error");
                            }
                        }
                    }, 1000);
                    return;
                }

                // ... Stages 1, 2, 3 (Unchanged) ...
                const bodyText = document.body.innerText || "";
                const isWaitPage = bodyText.includes('Please wait a moment') || bodyText.includes('ready in');
                const finalLink = document.getElementById('btn-download');

                if (isWaitPage || (finalLink && finalLink.href && finalLink.href.includes('ilide'))) {
                    updateStatusUI(3, "Generando Enlace", "Sincronizando...", "wait");
                    const checkTimer = setInterval(() => {
                        const link = document.getElementById('btn-download');
                        if (link && link.href && link.href.includes('ilide')) {
                            clearInterval(checkTimer);
                            updateStatusUI(3, "Redirigiendo", "Entrando a fase final...", "success");
                            link.target = "_self"; link.removeAttribute('rel'); window.location.href = link.href;
                        }
                    }, 500);
                    return;
                }

                const input = document.getElementById('url') || document.querySelector('input[name="url"]');
                const stage1Btn = document.querySelector('button[type="submit"].btn-primary');

                if (input && stage1Btn && !document.querySelector('.cf-turnstile')) {
                    updateStatusUI(1, "Iniciando", "Conectando...", "info");
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
                        updateStatusUI(2, "Verificación", "Resolviendo Captcha...", "wait");
                        const checkLoop = setInterval(() => {
                            const responseInput = document.querySelector('[name="cf-turnstile-response"]');
                            if (responseInput && responseInput.value) { clearInterval(checkLoop); updateStatusUI(2, "Verificado", "Accediendo...", "success"); setTimeout(() => downloadBtn.click(), 500); }
                        }, 800);
                    } else {
                        updateStatusUI(2, "Acceso Directo", "Saltando verificación...", "success");
                        setTimeout(() => downloadBtn.click(), 1000);
                    }
                }
            },
            args: [automationState.docUrl]
        });
    }
});
