/**
 * Scribd Premium Downloader
 * Content Script
 * @version 2.2.0
 */

// Core State
const AppState = {
  currentDocId: null,
  isProcessing: false,
  cachedName: null,
  cachedUrl: null
};

// Utilities
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
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    if (globalThis.jspdf?.jsPDF) return globalThis.jspdf.jsPDF;
    if (window.module?.exports?.jsPDF) return window.module.exports.jsPDF;
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
    if (!JsPDF) throw new Error("PDF Library missing.");
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
  Interface.updateState('loading', 'Preparando...');

  const originalBodyStyle = { ...document.body.style };

  try {
    const pdf = PDFHandler.init();
    const styleEl = document.createElement('style');
    styleEl.id = 'spd-clean-style';
    styleEl.innerHTML = `.toolbar_drop, .global_header, .mobile_overlay, #scribd_c_wrapper, .promo_banner { display: none !important; } .document_scroller { overflow: hidden !important; padding: 0 !important; margin: 0 !important; } .outer_page_container { margin: 0 auto !important; padding: 0 !important; border: none !important; box-shadow: none !important; } body { background: #fff !important; overflow: hidden !important; }`;
    document.head.appendChild(styleEl);

    const pages = document.querySelectorAll("div.outer_page_container div[id^='outer_page_']");
    const total = pages.length;
    if (total === 0) throw new Error("No se detectaron páginas.");

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const viewportH = window.innerHeight; const pageH = page.offsetHeight; const pageW = page.offsetWidth; const viewportW = window.innerWidth;
      let zoomH = viewportH / pageH; let zoomW = viewportW / pageW;
      let targetZoom = Math.min(zoomH, zoomW, 1) * 0.98;
      document.body.style.zoom = targetZoom;
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
        Interface.updateProgress(pct, `Procesando ${i + 1}/${total}`);
      }
    }

    Interface.updateState('saving', 'Guardando...');
    const fname = Utils.getCleanFilename();
    pdf.save(`${fname}.pdf`);
    Interface.updateState('success', '¡Listo!');

    // Cleanup
    document.body.style.zoom = originalBodyStyle.zoom || "";
    document.body.style.overflow = originalBodyStyle.overflow || "";
    document.getElementById('spd-clean-style')?.remove();
    setTimeout(() => { AppState.isProcessing = false; document.getElementById('sdl-overlay')?.remove(); }, 5000);

  } catch (e) {
    console.error(e);
    document.body.style.zoom = originalBodyStyle.zoom || "";
    document.body.style.overflow = originalBodyStyle.overflow || "";
    document.getElementById('spd-clean-style')?.remove();
    Interface.updateState('error', 'Error: ' + e.message);
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
    const overlay = document.createElement('div');
    overlay.id = 'sdl-overlay';

    let contentHtml = `
            <div class="sdl-card sdl-glass">
                <div class="sdl-header">
                    <span class="sdl-brand">⚡ Scribd Premium</span>
                    <button class="sdl-close">×</button>
                </div>
                <div class="sdl-info-grid">
                    <div class="sdl-row"><span class="sdl-label">ID Doc:</span><span class="sdl-value">${docId}</span></div>
                    <div class="sdl-row"><span class="sdl-label">Archivo:</span><span class="sdl-value sdl-truncate" title="${docName}">${docName}</span></div>
        `;

    if (!isEmbed) {
      contentHtml += `
                </div>
                <div class="sdl-actions">
                    <div class="sdl-btn-container">
                        <button id="sdl-action-btn" class="sdl-btn sdl-btn-glow">
                            <span>ACTIVAR MODO DESCARGA</span>
                            <span class="sdl-badge">GO</span>
                        </button>
                    </div>
                </div>
            `;
    } else {
      const pageCount = Utils.countPages();
      contentHtml += `
                    <div class="sdl-row"><span class="sdl-label">Páginas:</span><span class="sdl-value">${pageCount > 0 ? pageCount : 'Analizando...'}</span></div>
                </div>
                <div class="sdl-progress-track"><div id="sdl-progress-fill"></div></div>
                
                <div class="sdl-actions">
                    <div class="sdl-btn-container">
                        <button id="sdl-action-btn" class="sdl-btn sdl-btn-primary">
                            <span>ESCANEO INTELIGENTE (HQ)</span>
                            <span class="sdl-badge safe">100% SEGURO</span>
                        </button>
                        <span class="sdl-tooltip">Captura cada página como imagen de alta resolución. Sólido y fiable si otros métodos fallan.</span>
                    </div>

                    <div class="sdl-divider">OPCIONES AVANZADAS</div>

                    <div class="sdl-btn-container">
                        <button id="sdl-bridge-btn" class="sdl-btn sdl-btn-vector">
                            <span>PDF ORIGINAL</span>
                            <span class="sdl-badge beta">AUTO</span>
                        </button>
                        <span class="sdl-tooltip">Intenta automatizar la extracción del archivo PDF original desde servidores externos.</span>
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
        Utils.sendMessageAsync({ action: "open_external_downloader", docUrl: targetUrl });
      };
    }

    const closeBtn = overlay.querySelector('.sdl-close');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
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

if (window.SDL_Started) { window.initSDL(); } else { window.SDL_Started = true; setInterval(() => { const id = Utils.getDocumentId(); if (id && !document.getElementById('sdl-overlay')) Interface.render(); }, 2000); }
