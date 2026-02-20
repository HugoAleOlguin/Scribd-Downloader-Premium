/**
 * Scribd Premium Downloader
 * Content Script with i18n
 * @version 2.4.0
 */

// I18n loaded from libs/i18n.js




const AppState = {
  currentDocId: null,
  isProcessing: false,
  cachedName: null,
  cachedUrl: null,
  language: 'es' // Default
};

// ... Utils and PDFHandler (unchanged) ...
const Utils = {
  getDocumentId: () => {
    try {
      const url = window.location.href;
      let match = url.match(/(?:doc|document|embeds|read|book|audiobook)\/(\d+)/);
      if (match) return match[1];
      const iosUrl = document.querySelector('meta[property="al:ios:url"]');
      if (iosUrl) {
        match = iosUrl.content.match(/scribd:\/\/doc\/(\d+)/);
        if (match) return match[1];
      }
      return null;
    } catch (e) { return null; }
  },
  isEmbedView: () => window.location.href.includes('/embeds/'),
  countPages: () => document.querySelectorAll("div.outer_page_container div[id^='outer_page_']").length,
  sendMessageAsync: (msg) => new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, response => resolve(response || {}));
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  }),
  getJsPDF: () => {
    // En un content script de Chrome MV3, jsPDF UMD siempre elige la rama
    // GLOBAL porque typeof module y typeof exports son 'undefined' dentro
    // del scope léxico de la IIFE. Asignar window.module no las afecta.
    // jsPDF registra su clase en: globalThis.jspdf = { jsPDF: class JsPDF... }
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    if (globalThis.jspdf?.jsPDF) return globalThis.jspdf.jsPDF;

    // Fallbacks por si alguna versión del bundle usa una clave distinta
    if (window.jspdf?.default) return window.jspdf.default;

    // Algunas builds antiguas exponían la clase directamente como window.jsPDF
    if (typeof window.jsPDF === 'function') return window.jsPDF;

    return null;
  },
  getCleanFilename: () => {
    try {
      if (AppState.cachedName) return AppState.cachedName;
      const specificTitle = document.querySelector('[data-e2e="doc_page_title"]');
      if (specificTitle && specificTitle.innerText.trim()) return sanitizeFilename(specificTitle.innerText);
      const embedTitle = document.querySelector('.title');
      if (embedTitle && embedTitle.innerText.trim()) return sanitizeFilename(embedTitle.innerText);
      let docTitle = document.title || "documento";
      return sanitizeFilename(docTitle.replace(/\| Scribd/gi, '').replace(/Lea en línea/gi, '').replace(/Scribd/gi, ''));
    } catch (e) { return `documento_${Date.now()}`; }
  },
  saveDocName: (id, name, fullUrl) => {
    if (!id) return;
    const data = {};
    if (name) data[`doc_${id}`] = name;
    if (fullUrl) data[`url_${id}`] = fullUrl;
    chrome.storage.local.set(data);
  },
  loadDocData: (id) => {
    return new Promise(resolve => {
      chrome.storage.local.get([`doc_${id}`, `url_${id}`], (result) => {
        resolve({ name: result[`doc_${id}`] || null, fullUrl: result[`url_${id}`] || null });
      });
    });
  }
};

const PDFHandler = {
  init: () => {
    const JsPDF = Utils.getJsPDF();
    // Si la librería no cargó, el shim no funcionó o la extensión no se recargó.
    if (!JsPDF) throw new Error("Librería PDF no cargada. Recarga la página (F5) o reinstala la extensión.");
    const doc = new JsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
    doc.deletePage(1);
    return doc;
  },
  addPage: (doc, imgData, rect) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const dpr = window.devicePixelRatio || 1;
          let sx = rect.x * dpr, sy = rect.y * dpr, sw = rect.width * dpr, sh = rect.height * dpr;
          canvas.width = sw; canvas.height = sh;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          const A4_W = 595.28; const A4_H = 841.89;
          doc.addPage([A4_W, A4_H]);
          const scale = (A4_W - 20) / sw; const printH = sh * scale; const printW = A4_W - 20;
          if (printH <= A4_H) {
            const posY = (A4_H - printH) / 2;
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, posY, printW, printH, undefined, 'SLOW');
          } else {
            const scaleH = (A4_H - 20) / sh; const printW_H = sw * scaleH; const posX = (A4_W - printW_H) / 2;
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', posX, 10, printW_H, A4_H - 20, undefined, 'SLOW');
          }
          resolve();
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error("Image Load Error"));
      img.src = imgData;
    });
  }
};

async function executeHQScan() {
  if (AppState.isProcessing) return;
  AppState.isProcessing = true;

  // Robust Fallback for HQ Scan states
  const FallbackStates = { loading: "Cargando...", saving: "Guardando...", success: "Listo!", error: "Error: " };
  const I18nSafe = window.I18n || { es: { overlay: { states: FallbackStates } } };
  const T = (I18nSafe[AppState.language]?.overlay?.states) || I18nSafe.es?.overlay?.states || FallbackStates;

  // Utilidad de zoom cross-browser: Chrome soporta `zoom`, Firefox requiere `transform:scale`
  const isFirefox = navigator.userAgent.includes('Firefox');
  const applyZoom = (level) => {
    if (isFirefox) {
      // Firefox: usamos transform en el wrapper principal del documento
      const scroller = document.querySelector('.document_scroller') || document.body;
      scroller.style.transformOrigin = 'top left';
      scroller.style.transform = `scale(${level})`;
    } else {
      document.body.style.zoom = level;
    }
  };
  const resetZoom = () => {
    if (isFirefox) {
      const scroller = document.querySelector('.document_scroller') || document.body;
      scroller.style.transform = '';
      scroller.style.transformOrigin = '';
    } else {
      document.body.style.zoom = '';
    }
  };

  Interface.updateState('loading', T.loading);
  const originalOverflow = document.body.style.overflow;

  try {
    const pdf = PDFHandler.init();
    const styleEl = document.createElement('style');
    styleEl.id = 'spd-clean-style';
    styleEl.innerHTML = `.toolbar_drop, .global_header, .mobile_overlay, #scribd_c_wrapper, .promo_banner { display: none !important; } .document_scroller { overflow: hidden !important; padding: 0 !important; margin: 0 !important; } .outer_page_container { margin: 0 auto !important; padding: 0 !important; border: none !important; box-shadow: none !important; } body { background: #fff !important; overflow: hidden !important; }`;
    document.head.appendChild(styleEl);

    const pages = document.querySelectorAll("div.outer_page_container div[id^='outer_page_']");
    const total = pages.length;
    if (total === 0) throw new Error("No pages found.");

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const viewportH = window.innerHeight; const pageH = page.offsetHeight; const pageW = page.offsetWidth; const viewportW = window.innerWidth;
      let zoomH = viewportH / pageH; let zoomW = viewportW / pageW;
      let targetZoom = Math.min(zoomH, zoomW, 1) * 0.98;
      applyZoom(targetZoom);
      page.scrollIntoView({ behavior: 'instant', block: 'center' });

      await new Promise(r => setTimeout(r, 1200));
      const rect = page.getBoundingClientRect();

      const overlay = document.getElementById('sdl-overlay');
      if (overlay) overlay.style.display = 'none';
      await new Promise(r => setTimeout(r, 200));

      const res = await Utils.sendMessageAsync({ action: "capture_tab" });
      if (overlay) overlay.style.display = 'flex';

      if (res.success && res.image) {
        await PDFHandler.addPage(pdf, res.image, rect);
        const pct = Math.round(((i + 1) / total) * 100);
        Interface.updateProgress(pct, `${i + 1}/${total}`);
      } else if (!res.success) {
        // Fallo silencioso en captura: se continúa con las demás páginas
        console.warn('[SPD] Captura fallida en página', i + 1, res);
      }
    }

    Interface.updateState('saving', T.saving);
    const fname = Utils.getCleanFilename();
    pdf.save(`${fname}.pdf`);
    Interface.updateState('success', T.success);

    // Cleanup
    resetZoom();
    document.body.style.overflow = originalOverflow || '';
    document.getElementById('spd-clean-style')?.remove();
    setTimeout(() => { AppState.isProcessing = false; document.getElementById('sdl-overlay')?.remove(); }, 5000);

  } catch (e) {
    console.error(e);
    resetZoom();
    document.body.style.overflow = originalOverflow || '';
    document.getElementById('spd-clean-style')?.remove();
    Interface.updateState('error', T.error + e.message);
    AppState.isProcessing = false;
    if (document.getElementById('sdl-overlay')) document.getElementById('sdl-overlay').style.display = 'flex';
  }
}

function sanitizeFilename(name) { return name.replace(/[^a-z0-9\s-_\u00C0-\u00FF]/gi, '').trim().replace(/\s+/g, '_'); }

// --- UI Interface ---

const Interface = {
  render: async () => {
    if (document.getElementById('sdl-overlay')) return;
    const docId = Utils.getDocumentId();
    if (!docId) return;
    const isEmbed = Utils.isEmbedView();

    // Cargar preferencia de idioma con manejo de contexto invalidado.
    // 'Extension context invalidated' ocurre si la extensión se recargó
    // sin recargar la pestaña del documento.
    try {
      chrome.storage.local.get(['language'], (res) => {
        if (chrome.runtime.lastError) {
          // Contexto inválido: usar idioma por defecto y continuar
          AppState.language = 'es';
        } else {
          AppState.language = (res && res.language) || 'es';
        }
        Interface.draw(docId, isEmbed);
      });
    } catch (e) {
      // Contexto de extensión ya no es válido: renderizar con fallback
      AppState.language = 'es';
      Interface.draw(docId, isEmbed);
    }
  },

  draw: async (docId, isEmbed) => {
    let storedData = { name: null, fullUrl: null };
    try { storedData = await Utils.loadDocData(docId); } catch (e) { }

    if (!isEmbed) {
      const rawName = Utils.getCleanFilename();
      const rawUrl = window.location.href;
      if (rawName && rawName !== "documento") {
        Utils.saveDocName(docId, rawName, rawUrl);
        AppState.cachedName = rawName;
        AppState.cachedUrl = rawUrl;
      }
    } else {
      if (storedData.name) AppState.cachedName = storedData.name;
      if (storedData.fullUrl) AppState.cachedUrl = storedData.fullUrl;
    }

    const docName = AppState.cachedName || Utils.getCleanFilename();

    // I18N TEXTS
    // I18N TEXTS - Failsafe in case I18n lib isn't loaded (e.g. extension not reloaded)
    // Fallback usado solo si la librería i18n.js no cargó correctamente.
    // Debe mantenerse sincronizado con libs/i18n.js.
    const FallbackI18n = {
      es: {
        overlay: {
          title: "⚡ Scribd Premium", id: "ID Doc:", file: "Archivo:", pages: "Páginas:", analyzing: "Contando páginas...",
          activate: "▶ ACTIVAR MODO DESCARGA",
          hq_btn: "ESCANEO INTELIGENTE (HQ)", hq_badge: "100% SEGURO",
          hq_tooltip: "Captura cada página individualmente como imagen PNG de alta resolución y las ensambla en un PDF.",
          adv_opts: "OPCIONES AVANZADAS",
          vec_btn: "PDF ORIGINAL", vec_badge: "AUTOMÁTICO",
          vec_tooltip: "Intenta descargar el PDF original desde servidores externos. Si falla, usa 'Escaneo HQ'.",
          states: { loading: "Preparando escaneo...", saving: "Generando PDF...", success: "¡PDF Guardado!", error: "Error: " }
        }
      }
    };
    const I18nSafe = window.I18n || FallbackI18n;
    const T = (I18nSafe[AppState.language] && I18nSafe[AppState.language].overlay) ? I18nSafe[AppState.language].overlay : (I18nSafe.es?.overlay || FallbackI18n.es.overlay);

    const overlay = document.createElement('div');
    overlay.id = 'sdl-overlay';

    let contentHtml = `
            <div class="sdl-card sdl-glass">
                <div class="sdl-header">
                    <span class="sdl-brand">${T.title}</span>
                    <button class="sdl-close">×</button>
                </div>
                <div class="sdl-info-grid">
                    <div class="sdl-row"><span class="sdl-label">${T.id}</span><span class="sdl-value">${docId}</span></div>
                    <div class="sdl-row"><span class="sdl-label">${T.file}</span><span class="sdl-value sdl-truncate" title="${docName}">${docName}</span></div>
        `;

    if (!isEmbed) {
      contentHtml += `
                </div>
                <div class="sdl-actions">
                    <div class="sdl-btn-container">
                        <button id="sdl-action-btn" class="sdl-btn sdl-btn-glow">
                            <span>${T.activate}</span>
                            <span class="sdl-badge">GO</span>
                        </button>
                    </div>
                </div>
            `;
    } else {
      const pageCount = Utils.countPages();
      contentHtml += `
                    <div class="sdl-row"><span class="sdl-label">${T.pages}</span><span class="sdl-value">${pageCount > 0 ? pageCount : T.analyzing}</span></div>
                </div>
                <div class="sdl-progress-track"><div id="sdl-progress-fill"></div></div>
                
                <div class="sdl-actions">
                    <div class="sdl-btn-container">
                        <button id="sdl-action-btn" class="sdl-btn sdl-btn-primary">
                            <span>${T.hq_btn}</span>
                            <span class="sdl-badge safe">${T.hq_badge}</span>
                        </button>
                        <span class="sdl-tooltip">${T.hq_tooltip}</span>
                    </div>

                    <div class="sdl-divider">${T.adv_opts}</div>

                    <div class="sdl-btn-container">
                        <button id="sdl-bridge-btn" class="sdl-btn sdl-btn-vector">
                            <span>${T.vec_btn}</span>
                            <span class="sdl-badge beta">${T.vec_badge}</span>
                        </button>
                        <span class="sdl-tooltip">${T.vec_tooltip}</span>
                    </div>
                </div>
            `;
    }

    overlay.innerHTML = contentHtml;
    document.body.appendChild(overlay);

    const mainBtn = document.getElementById('sdl-action-btn');
    if (mainBtn) {
      mainBtn.onclick = isEmbed ? executeHQScan : () => {
        window.location.href = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-1`;
      };
    }

    const bridgeBtn = document.getElementById('sdl-bridge-btn');
    if (bridgeBtn) {
      bridgeBtn.onclick = async () => {
        let targetUrl = AppState.cachedUrl;
        if (!targetUrl) {
          const slug = sanitizeFilename(docName).replace(/_/g, '-').toLowerCase();
          targetUrl = `https://es.scribd.com/document/${docId}/${slug}`;
        }
        // Pasar el nombre del documento para que se use como nombre del archivo descargado
        Utils.sendMessageAsync({ action: "open_external_downloader", docUrl: targetUrl, docName: docName });
      };
    }

    const closeBtn = overlay.querySelector('.sdl-close');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();

    // Listen for language changes live
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.language) {
        overlay.remove();
        Interface.render();
      }
    });
  },

  updateState: (state, text) => {
    const btn = document.getElementById('sdl-action-btn');
    if (btn) {
      btn.querySelector('span:first-child').innerText = text;
      if (state === 'loading') { btn.disabled = true; btn.style.cursor = 'wait'; }
      if (state === 'error') { btn.style.background = '#ff5252'; btn.disabled = false; btn.style.cursor = 'pointer'; }
      if (state === 'success') { btn.style.background = '#00e676'; btn.classList.add('sdl-pulse-success'); btn.disabled = true; }
    }
  },
  updateProgress: (percent, text) => {
    const fill = document.getElementById('sdl-progress-fill');
    const btn = document.getElementById('sdl-action-btn');
    if (fill) fill.style.width = `${percent}%`;
    if (text && btn) btn.querySelector('span:first-child').innerText = text;
  }
};

window.initSDL = () => { Interface.render(); };

// El intervalo verifica que el contexto de la extensión siga válido antes
// de llamar a la API. Si no, se detiene para no generar errores en consola.
if (window.SDL_Started) {
  window.initSDL();
} else {
  window.SDL_Started = true;
  const sdlInterval = setInterval(() => {
    // Verificar si el runtime sigue activo
    try {
      if (!chrome.runtime?.id) {
        clearInterval(sdlInterval);
        return;
      }
    } catch (e) {
      clearInterval(sdlInterval);
      return;
    }
    const id = Utils.getDocumentId();
    if (id && !document.getElementById('sdl-overlay')) Interface.render();
  }, 2000);
}
