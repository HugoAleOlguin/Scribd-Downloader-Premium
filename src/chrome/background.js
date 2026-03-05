/**
 * Scribd Premium Downloader
 * Background - Chrome / Chromium / Edge / Brave
 * @version 2.8.0
 *
 * Usa service_worker (Manifest V3 de Chrome).
 * I18n se carga desde libs/i18n.js mediante "importScripts".
 */

importScripts('libs/i18n.js');

// ─── Estado persistente (Service Worker puede suspenderse en Chrome) ───────────
const StateManager = {
    get: async () => {
        try {
            const result = await chrome.storage.local.get(['automationState', 'language']);
            const state = result.automationState || { tabId: null, docUrl: null, docName: '', active: false };
            return { ...state, language: result.language || 'es' };
        } catch (e) {
            return { tabId: null, docUrl: null, docName: '', active: false, language: 'es' };
        }
    },
    set: async (state) => {
        await chrome.storage.local.set({ automationState: state });
    }
};

// ─── Handlers de mensajes desde content.js ────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Chrome acepta captureVisibleTab con null (window actual)
    if (request.action === "capture_tab") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, image: dataUrl });
            }
        });
        return true;
    }

    if (request.action === "fetch_image") {
        fetch(request.url)
            .then(r => r.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ success: true, data: reader.result });
                reader.readAsDataURL(blob);
            })
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === "validate_download") {
        fetch(request.url, { method: 'HEAD' })
            .then(response => {
                const type = response.headers.get('content-type');
                const length = response.headers.get('content-length');
                const size = length ? parseInt(length) : null;

                const isValidType = type && (type.includes('pdf') || type.includes('octet') || type.includes('force-download'));
                // Si no hay content-length, chrome igual deja pasar (confiamos en content-type)
                const isValid = response.ok && (size === null ? isValidType : size > 2048);

                if (isValid) {
                    const rawName = request.docName || 'Scribd_Document_Premium';
                    const safeFilename = rawName.replace(/[^a-z0-9\s\-_\u00C0-\u00FF]/gi, '').trim().replace(/\s+/g, '_') || 'Scribd_Document_Premium';
                    chrome.downloads.download({ url: request.url, filename: `${safeFilename}.pdf`, saveAs: true });
                    sendResponse({ valid: true });
                } else {
                    sendResponse({ valid: false, reason: `type=${type}, size=${size}` });
                }
            })
            .catch(err => sendResponse({ valid: false, reason: `Network Error: ${err.message}` }));
        return true;
    }

    if (request.action === "open_external_downloader") {
        const targetUrl = "https://scribd.vdownloaders.com/";
        chrome.tabs.create({ url: targetUrl }, async (newTab) => {
            await StateManager.set({
                docUrl: request.docUrl,
                docName: request.docName || '',
                active: true,
                tabId: newTab.id
            });
            sendResponse({ success: true });
        });
        return true;
    }
});

// ─── Puerto keepalive (chrome.runtime.onConnect) ──────────────────────────────
// El content script abre un puerto 'spd-keepalive' al iniciar el scan HQ.
// Mientras el puerto esté conectado el Service Worker no se suspende.
// No es necesario procesar los mensajes 'ping'; basta con mantener la referencia.
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'spd-keepalive') {
        // La conexión activa mantiene el SW vivo; nada más que hacer aquí.
        port.onDisconnect.addListener(() => { /* scan terminado, SW puede dormir */ });
    }
});

// ─── Listener de navegación: inyecta lógica de automatización ─────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;

    const state = await StateManager.get();
    if (!state.active || tabId !== state.tabId) return;

    chrome.scripting.executeScript({
        target: { tabId },
        func: injectAutopilot,
        args: [state.docUrl, state.language, I18n, state.docName || '']
    });
});

// ─── Lógica del autopilot (se serializa y ejecuta en la pestaña destino) ──────
function injectAutopilot(urlToPaste, langCode, Translations, docName) {
    const currentUrl = window.location.href;
    const T = Translations[langCode]?.toast || Translations['es'].toast;

    const updateStatusUI = (step, title, status, type = "info", customHelp = null) => {
        let container = document.getElementById('spd-ui-root');
        if (!container) {
            const style = document.createElement('style');
            style.innerHTML = `
                #spd-ui-root { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; width: 380px; pointer-events: none; }
                .spd-toast { pointer-events: auto; background: rgba(20,20,24,0.98); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); color: #fff; animation: spd-slide 0.4s cubic-bezier(0.2,0.8,0.2,1); display: flex; align-items: start; gap: 14px; position: relative; }
                .spd-icon { font-size: 22px; line-height: 1; margin-top: 2px; }
                .spd-content { flex: 1; }
                .spd-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; display: block; letter-spacing: -0.01em; }
                .spd-status { font-size: 13px; opacity: 0.85; line-height: 1.4; color: #a1a1aa; font-weight: 500; }
                .spd-progress { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 12px; overflow: hidden; }
                .spd-bar { height: 100%; background: #00e676; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(0,230,118,0.5); }
                .spd-help { margin-top: 12px; font-size: 12px; background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); padding: 10px; border-radius: 6px; color: #ff8a80; line-height: 1.4; display: block; }
                .spd-help-warn { margin-top: 12px; font-size: 12px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); padding: 10px; border-radius: 6px; color: #fcd34d; line-height: 1.4; display: block; }
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
            manual: { color: "#f59e0b", icon: "👆" },
            success: { color: "#10b981", icon: "✨" },
            error: { color: "#ef4444", icon: "⚠️" }
        };
        const c = config[type] || config.info;
        const pct = Math.min(100, (step / 4) * 100);

        // Elige el estilo del bloque de ayuda según si es un aviso o un error
        const helpClass = (type === 'manual' || type === 'wait') ? 'spd-help-warn' : 'spd-help';

        container.innerHTML = `
            <div class="spd-toast">
                <button class="spd-close" onclick="document.getElementById('spd-ui-root').remove()">×</button>
                <div class="spd-icon">${c.icon}</div>
                <div class="spd-content">
                    <span class="spd-title" style="color:${c.color}">${title}</span>
                    <div class="spd-status">${status}</div>
                    ${type !== 'error' && type !== 'manual' ? `<div class="spd-progress"><div class="spd-bar" style="width:${pct}%"></div></div>` : ''}
                    ${customHelp ? `<div class="${helpClass}">${customHelp}</div>` : ''}
                </div>
            </div>
        `;
    };

    // === Fase final: ilide.info viewer ===
    if (currentUrl.includes('ilide.info')) {
        updateStatusUI(3, T.analyzing.title, T.analyzing.desc, "wait");

        let attempts = 0;
        let found = false;
        // Máximo 45 intentos × 1s = 45 segundos de espera
        const MAX_ILIDE_ATTEMPTS = 45;

        const checkIframe = setInterval(() => {
            if (found) { clearInterval(checkIframe); return; }
            attempts++;

            // Detectar error explícito del visor antes que nada
            const errorWrapper = document.querySelector('#errorContainer, .error-container, [class*="error"]');
            if (errorWrapper && errorWrapper.offsetParent !== null && errorWrapper.innerText?.trim()) {
                clearInterval(checkIframe); found = true;
                updateStatusUI(4, T.error_detected.title, T.error_detected.desc, "error", T.error_detected.help);
                return;
            }

            const viewerFrame = document.querySelector('iframe[src*="viewer.html"]');
            if (viewerFrame) {
                try {
                    const urlParam = new URL(viewerFrame.src).searchParams.get('file');
                    if (urlParam) {
                        found = true;
                        clearInterval(checkIframe);
                        const directPdfUrl = decodeURIComponent(urlParam);

                        // Verificar que la URL apunta a algo con extensión PDF o es una URL de descarga válida
                        const looksPdf = /\.pdf(\?|$)/i.test(directPdfUrl) || directPdfUrl.includes('download');
                        if (!looksPdf) {
                            updateStatusUI(4, T.error_damaged.title, T.error_damaged.desc, "error", T.error_damaged.help);
                            return;
                        }

                        updateStatusUI(3, T.validating.title, T.validating.desc, "wait");
                        chrome.runtime.sendMessage({ action: "validate_download", url: directPdfUrl, docName }, (r) => {
                            if (r?.valid) {
                                updateStatusUI(4, T.success.title, T.success.desc, "success");
                            } else {
                                updateStatusUI(4, T.error_damaged.title, T.error_damaged.desc, "error", T.error_damaged.help);
                            }
                        });
                        return;
                    }
                } catch (e) { /* URL malformada — seguir esperando */ }
            }

            if (attempts >= MAX_ILIDE_ATTEMPTS && !found) {
                clearInterval(checkIframe);
                updateStatusUI(4, T.error_timeout.title, T.error_timeout.desc, "error", T.error_damaged.help);
            }
        }, 1000);
        return;
    }

    // === Fase de espera del link en vDownloaders ===
    const bodyText = document.body.innerText || "";
    const isWaitPage = bodyText.includes('Please wait a moment') || bodyText.includes('ready in');
    const finalLink = document.getElementById('btn-download');

    if (isWaitPage || finalLink?.href?.includes('ilide')) {
        updateStatusUI(3, T.wait.title, T.wait.desc, "wait");

        let waitTicks = 0;
        // Máximo 90s esperando el link de descarga antes de avisar amablemente
        const MAX_WAIT_TICKS = 180; // 180 × 500ms = 90s

        const checkTimer = setInterval(() => {
            waitTicks++;
            const link = document.getElementById('btn-download');
            if (link?.href?.includes('ilide')) {
                clearInterval(checkTimer);
                updateStatusUI(3, T.redirect.title, T.redirect.desc, "success");
                link.target = "_self";
                link.removeAttribute('rel');
                window.location.href = link.href;
                return;
            }
            if (waitTicks >= MAX_WAIT_TICKS) {
                clearInterval(checkTimer);
                // No mostramos error crítico — es más un "aviso tranquilo"
                updateStatusUI(3, T.wait_timeout.title, T.wait_timeout.desc, "wait", T.wait_timeout.help);
            }
        }, 500);
        return;
    }

    // === Fase 1: formulario de URL ===
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

    // === Fase 2: botón de descarga + Cloudflare ===
    const downloadBtn = document.querySelector('button.btn-primary');
    const cloudflareBox = document.querySelector('.cf-turnstile');

    if (downloadBtn && !input) {
        if (cloudflareBox && cloudflareBox.offsetParent !== null) {
            updateStatusUI(2, T.verify.title, T.verify.desc, "wait");

            let cfTicks = 0;
            // Si Cloudflare no resuelve en 45s → pedir ayuda manual
            const MAX_CF_TICKS = 56; // 56 × 800ms ≈ 45s
            let cfManualShown = false;

            const checkLoop = setInterval(() => {
                cfTicks++;
                const responseInput = document.querySelector('[name="cf-turnstile-response"]');
                if (responseInput?.value) {
                    clearInterval(checkLoop);
                    updateStatusUI(2, T.verify_done.title, T.verify_done.desc, "success");
                    setTimeout(() => downloadBtn.click(), 500);
                    return;
                }
                // Después de ~45s sin resolución, mostrar aviso amigable (solo una vez)
                if (cfTicks >= MAX_CF_TICKS && !cfManualShown) {
                    cfManualShown = true;
                    // Seguimos el intervalo activo por si el usuario completa el captcha después
                    updateStatusUI(2, T.verify_manual.title, T.verify_manual.desc, "manual", T.verify_manual.help);
                }
            }, 800);
        } else {
            updateStatusUI(2, T.verify_done.title, T.verify_done.desc, "success");
            setTimeout(() => downloadBtn.click(), 1000);
        }
    }
}
