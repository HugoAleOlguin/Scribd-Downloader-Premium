/**
 * Scribd Premium Downloader
 * Content Script with i18n
 * @version 2.7.0
 */

// I18n loaded from libs/i18n.js




const AppState = {
  currentDocId: null,
  isProcessing: false,
  cachedName: null,
  cachedUrl: null,
  language: 'en' // Default
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
  // Método legado (no se usa ya en el flujo principal pero se conserva por compatibilidad)
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
  },
  // Recibe el data-URL ya renderizado por html2canvas (recortado al elemento).
  // No necesita img.onload porque el data-URL ya está listo.
  addPageFromCanvas: (doc, dataUrl, rect) => {
    return new Promise((resolve, reject) => {
      try {
        const A4_W = 595.28; const A4_H = 841.89;
        doc.addPage([A4_W, A4_H]);
        const sw = rect.width; const sh = rect.height;
        const scale = (A4_W - 20) / sw; const printH = sh * scale; const printW = A4_W - 20;
        if (printH <= A4_H) {
          const posY = (A4_H - printH) / 2;
          doc.addImage(dataUrl, 'PNG', 10, posY, printW, printH, undefined, 'SLOW');
        } else {
          const scaleH = (A4_H - 20) / sh; const printW_H = sw * scaleH; const posX = (A4_W - printW_H) / 2;
          doc.addImage(dataUrl, 'PNG', posX, 10, printW_H, A4_H - 20, undefined, 'SLOW');
        }
        resolve();
      } catch (err) { reject(err); }
    });
  }
};

// Captura un elemento DOM como data URL usando html2canvas.
// Es más confiable que captureVisibleTab: no depende del Service Worker
// ni de que la pestaña esté activa en el momento exacto de la captura.
async function captureElementWithHtml2Canvas(element) {
  if (typeof html2canvas !== 'function') {
    throw new Error('html2canvas no disponible. Recarga la extensión (F5).');
  }
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: window.devicePixelRatio || 1,
    backgroundColor: '#ffffff',
    logging: false,
    // Excluimos el overlay para que no aparezca en la captura del documento
    ignoreElements: (el) => el.id === 'sdl-overlay' || el.id === 'spd-clean-style'
  });
  return canvas.toDataURL('image/png');
}

async function executeHQScan(mode = 'quality') {
  if (AppState.isProcessing) return;
  AppState.isProcessing = true;

  // Robust Fallback for HQ Scan states
  const FallbackStates = { loading: "Cargando...", saving: "Guardando...", success: "Listo!", error: "Error: " };
  const I18nSafe = window.I18n || { es: { overlay: { states: FallbackStates } } };
  const T = (I18nSafe[AppState.language]?.overlay?.states) || I18nSafe.es?.overlay?.states || FallbackStates;

  // Utilidad de zoom cross-browser: Chrome y Firefox 126+ soportan CSS `zoom`.
  // NOTA: transform:scale fue descartado porque es visual-only (no genera reflow),
  // por lo que scrollIntoView seguía usando coordenadas sin escalar y
  // captureVisibleTab no capturaba el contenido fuera del viewport original.
  const applyZoom = (level) => {
    document.documentElement.style.zoom = level;
  };
  const resetZoom = () => {
    document.documentElement.style.zoom = '';
  };

  // ─── SW Keepalive ─────────────────────────────────────────────────────────────
  // En Chrome MV3, el Service Worker se suspende ~30s después de quedar inactivo.
  // Abrimos un puerto persistente durante el scan para mantenerlo despierto,
  // evitando que los mensajes capture_tab lleguen a un SW dormido y fallen.
  function openSWKeepalive() {
    try {
      const port = chrome.runtime.connect({ name: 'spd-keepalive' });
      // Heartbeat cada 20s. Envuelto en try-catch porque Firefox puede
      // desconectar el puerto antes de que el intervalo se limpie,
      // generando "Attempting to use a disconnected port object".
      const interval = setInterval(() => {
        try { port.postMessage('ping'); }
        catch (_) { clearInterval(interval); }  // puerto ya cerrado, limpiar
      }, 20000);
      port.onDisconnect.addListener(() => clearInterval(interval));
      return port;
    } catch (e) {
      // Firefox no necesita keepalive (tiene background page persistente)
      return null;
    }
  }

  Interface.updateState('loading', T.loading);
  const originalOverflow = document.body.style.overflow;
  // Abrimos el puerto keepalive antes de empezar el scan.
  // Esto mantiene el Service Worker de Chrome despierto durante todo el proceso.
  const keepalivePort = openSWKeepalive();

  try {
    const styleEl = document.createElement('style');
    styleEl.id = 'spd-clean-style';
    styleEl.innerHTML = `.toolbar_drop, .global_header, .mobile_overlay, #scribd_c_wrapper, .promo_banner { display: none !important; } .document_scroller { overflow: hidden !important; padding: 0 !important; margin: 0 !important; } .outer_page_container { margin: 0 auto !important; padding: 0 !important; border: none !important; box-shadow: none !important; } body { background: #fff !important; overflow: hidden !important; }`;
    document.head.appendChild(styleEl);

    const pages = document.querySelectorAll("div.outer_page_container div[id^='outer_page_']");
    const total = pages.length;
    if (total === 0) throw new Error("No pages found.");

    const fname = Utils.getCleanFilename();

    // Dividimos en lotes para evitar "invalid string length" en documentos grandes.
    // El motor V8 tiene un límite ~512 MB para strings; acumular cientos de páginas
    // en PNG dentro de un único jsPDF lo supera. Guardamos un PDF por lote y
    // dejamos que el GC libere memoria entre lotes.
    const PAGES_PER_CHUNK = 100;
    const totalChunks = Math.ceil(total / PAGES_PER_CHUNK);
    const needsChunking = totalChunks > 1;

    // Encontramos el contenedor de scroll de las páginas una sola vez.
    // overflow:hidden no impide el scroll programático (scrollTop sigue funcionando).
    const scrollContainer = (() => {
      let node = pages[0]?.parentElement;
      while (node && node !== document.documentElement) {
        const ov = getComputedStyle(node).overflow + getComputedStyle(node).overflowY;
        if (/(hidden|scroll|auto)/.test(ov)) return node;
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    })();

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const chunkStart = chunk * PAGES_PER_CHUNK;
      const chunkEnd = Math.min(chunkStart + PAGES_PER_CHUNK, total);
      const chunkLabel = needsChunking ? ` (parte ${chunk + 1}/${totalChunks})` : '';

      // Nuevo documento por lote → se libera al llamar pdf.save()
      const pdf = PDFHandler.init();

      for (let i = chunkStart; i < chunkEnd; i++) {
        const page = pages[i];

        // Medimos siempre las dimensiones reales a zoom 100%.
        // Esto garantiza que el canvas tenga las dimensiones correctas
        // y que addPageFromCanvas calcule bien el layout en A4.
        resetZoom();
        page.scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise(r => setTimeout(r, 900));

        const dpr = window.devicePixelRatio || 1;
        const vh = window.innerHeight;

        const firstRect = page.getBoundingClientRect();
        const pageW = firstRect.width;
        const pageH = firstRect.height;

        const overlay = document.getElementById('sdl-overlay');
        if (overlay) overlay.style.display = 'none';
        await new Promise(r => setTimeout(r, 100));

        // Espera a que las <img> visibles terminen de cargar antes de capturar.
        // Scribd lazy-carga el contenido al scrollear; sin esta espera el PDF
        // puede tener zonas en blanco o con calidad baja que parecen cortes.
        const waitImagesLoaded = () => new Promise(resolve => {
          const imgs = Array.from(page.querySelectorAll('img'))
            .filter(img => {
              const r = img.getBoundingClientRect();
              return r.top < window.innerHeight && r.bottom > 0 && r.width > 4;
            });
          const pending = imgs.filter(img => !img.complete);
          if (!pending.length) { requestAnimationFrame(resolve); return; }
          let done = 0;
          const onDone = () => { if (++done >= pending.length) resolve(); };
          pending.forEach(img => {
            img.addEventListener('load', onDone, { once: true });
            img.addEventListener('error', onDone, { once: true });
          });
          setTimeout(resolve, 2000); // fallback: capturar igual si tarda demasiado
        });

        let dataUrl;

        if (mode === 'quality') {
          // ── Modo Alta Calidad: strip-stitch ──────────────────────────────
          // Captura la página en franjas verticales y las une en un canvas.
          // Máxima resolución, aunque puede quedar un corte sutil entre franjas
          // en pantallas con DPR no entero (1.25x, 1.5x) o lazy-render lento.

          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = Math.round(pageW * dpr);
          fullCanvas.height = Math.round(pageH * dpr);
          const ctx = fullCanvas.getContext('2d');

          const STRIP_OVERLAP = 40; // px CSS de solapamiento entre franjas
          const STABLE_FRAMES = 3;  // frames sin cambio = scroll físicamente quieto

          // Espera a que scrollTop deje de cambiar durante N frames consecutivos.
          const waitScrollStable = () => new Promise(resolve => {
            let prev = scrollContainer.scrollTop;
            let stableCount = 0;
            const check = () => requestAnimationFrame(() => {
              const cur = scrollContainer.scrollTop;
              if (cur === prev) {
                if (++stableCount >= STABLE_FRAMES) requestAnimationFrame(resolve);
                else check();
              } else { prev = cur; stableCount = 0; check(); }
            });
            requestAnimationFrame(check);
          });

          let capturedH = 0;
          while (capturedH < pageH) {
            const curRect = page.getBoundingClientRect();
            const scrolledPast = Math.max(0, -curRect.top);
            const visibleTop = Math.max(0, curRect.top);
            const visibleBottom = Math.min(vh, curRect.bottom);
            const stripH = visibleBottom - visibleTop;

            if (stripH <= 0) break;

            const res = await Utils.sendMessageAsync({ action: 'capture_tab' });
            if (res.success && res.image) {
              await new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                  ctx.drawImage(
                    img,
                    Math.round(curRect.left * dpr), Math.round(visibleTop * dpr),
                    Math.round(pageW * dpr), Math.round(stripH * dpr),
                    0, Math.round(scrolledPast * dpr),
                    Math.round(pageW * dpr), Math.round(stripH * dpr)
                  );
                  resolve();
                };
                img.onerror = resolve;
                img.src = res.image;
              });
            } else {
              console.warn('[SPD] capture_tab fallido en página', i + 1, res.error);
            }

            capturedH = scrolledPast + stripH;
            if (capturedH < pageH) {
              scrollContainer.scrollTop += Math.max(1, Math.round(stripH - STRIP_OVERLAP));
              await waitScrollStable();
              await waitImagesLoaded();
            }
          }

          dataUrl = fullCanvas.toDataURL('image/png');

        } else {
          // ── Modo Sin Cortes: zoom-fit ─────────────────────────────────────
          // Reduce el zoom de la página para que quepa entera en el viewport
          // y toma UN único screenshot. No hay franjas, no hay cortes.
          // La imagen tiene menos píxeles que el modo Alta Calidad
          // (proporcional al nivel de zoom aplicado), pero el resultado
          // siempre es continuo sin importar la resolución de pantalla.

          const zoomRatio = Math.min(1.0, (vh * 0.95) / pageH);
          const needsZoom = zoomRatio < 1.0;

          if (needsZoom) {
            applyZoom(zoomRatio);
            await new Promise(r => setTimeout(r, 400)); // espera el reflow del zoom
            page.scrollIntoView({ behavior: 'instant', block: 'start' });
            await new Promise(r => setTimeout(r, 200));
          }

          await waitImagesLoaded();

          const fitRect = page.getBoundingClientRect();
          const fitCanvas = document.createElement('canvas');
          fitCanvas.width = Math.round(fitRect.width * dpr);
          fitCanvas.height = Math.round(fitRect.height * dpr);
          const fitCtx = fitCanvas.getContext('2d');

          const res = await Utils.sendMessageAsync({ action: 'capture_tab' });
          if (res.success && res.image) {
            await new Promise(resolve => {
              const img = new Image();
              img.onload = () => {
                fitCtx.drawImage(
                  img,
                  Math.round(fitRect.left * dpr),
                  Math.round(Math.max(0, fitRect.top) * dpr),
                  Math.round(fitRect.width * dpr),
                  Math.round(fitRect.height * dpr),
                  0, 0, fitCanvas.width, fitCanvas.height
                );
                resolve();
              };
              img.onerror = resolve;
              img.src = res.image;
            });
          } else {
            console.warn('[SPD] capture_tab fallido (fit) en página', i + 1, res.error);
          }

          if (needsZoom) resetZoom();

          // Pasamos las dimensiones ORIGINALES (sin zoom) para que jsPDF
          // calcule el layout A4 correctamente con el aspect ratio real.
          dataUrl = fitCanvas.toDataURL('image/png');
        }

        // Restaurar overlay y añadir la página al PDF (común a ambos modos)
        if (overlay) overlay.style.display = 'flex';
        await PDFHandler.addPageFromCanvas(pdf, dataUrl, { width: pageW, height: pageH });

        const pct = Math.round(((i + 1) / total) * 100);
        Interface.updateProgress(pct, `${i + 1}/${total}${chunkLabel}`);
      }

      // Guardar el lote y dar tiempo al GC antes de iniciar el siguiente.
      Interface.updateState('saving', T.saving + chunkLabel);
      const partSuffix = needsChunking ? `_parte_${chunk + 1}_de_${totalChunks}` : '';
      pdf.save(`${fname}${partSuffix}.pdf`);
      await new Promise(r => setTimeout(r, 800));
    }

    Interface.updateState('success', T.success);

    // Cleanup: cerramos el keepalive y restauramos el estado de la página
    keepalivePort?.disconnect();
    resetZoom();
    document.body.style.overflow = originalOverflow || '';
    document.getElementById('spd-clean-style')?.remove();
    setTimeout(() => { AppState.isProcessing = false; document.getElementById('sdl-overlay')?.remove(); }, 5000);

  } catch (e) {
    console.error(e);
    keepalivePort?.disconnect();
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
          title: "⚡ Scribd Premium", id: "ID:", file: "Archivo:", pages: "Páginas:", analyzing: "Contando páginas...",
          activate: "Ir al modo de descarga",
          hq_btn: "Escaneo Premium (Alta Calidad)", hq_badge: "RECOMENDADO",
          hq_tooltip: "Captura cada página como imagen de máxima resolución y genera un PDF completo.",
          adv_opts: "Opción alternativa",
          vec_btn: "Descargar PDF Original", vec_badge: "RÁPIDO",
          vec_tooltip: "Intenta obtener el PDF directamente del servidor externo. Si falla, usa el Escaneo Premium.",
          large_doc_warning: "⚠️ Documento extenso ({pages} páginas): el Escaneo Premium tardará bastante. Prueba primero 'Descargar PDF Original'.",
          hq_long_warning: "Escaneo iniciado. Puede tardar un buen rato — no cierres esta pestaña.",
          states: { loading: "Preparando escaneo...", saving: "Generando PDF...", success: "¡PDF guardado correctamente!", error: "Algo salió mal: " }
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

    // Declaradas antes del if/else: el handler de mainBtn.onclick las usa
    // desde fuera del bloque, por eso necesitan scope de función, no de bloque.
    const LARGE_DOC_THRESHOLD = 100;
    let isLargeDoc = false;

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

      // Umbral a partir del cual advertimos al usuario: documentos grandes
      // tardan horas en el modo HQ y generan múltiples archivos.
      isLargeDoc = pageCount >= LARGE_DOC_THRESHOLD;

      // Construir el mensaje interpolando el número real de páginas
      const warningText = isLargeDoc
        ? (T.large_doc_warning || '⚠️ Large document detected.').replace('{pages}', pageCount)
        : '';

      contentHtml += `
                    <div class="sdl-row"><span class="sdl-label">${T.pages}</span><span class="sdl-value">${pageCount > 0 ? pageCount : T.analyzing}</span></div>
                </div>
                <div class="sdl-progress-track"><div id="sdl-progress-fill"></div></div>

                ${isLargeDoc ? `
                <div class="sdl-large-doc-warning">
                  <p class="sdl-warning-text">${warningText}</p>
                  <button id="sdl-warning-pdf-btn" class="sdl-btn sdl-btn-vector sdl-btn-warning-cta">
                    <span>${T.vec_btn}</span>
                    <span class="sdl-badge beta">${T.vec_badge}</span>
                  </button>
                </div>` : ''}

                 <div class="sdl-actions">

                    <!-- Dos modos de escaneo presentados como opciones claras -->
                    <div class="sdl-btn-container">
                        <button id="sdl-hq-quality-btn" class="sdl-btn sdl-btn-primary sdl-btn-twoline">
                            <div class="sdl-btn-body">
                                <span class="sdl-btn-title">${T.hq_quality_btn || 'Alta Calidad'}</span>
                                <span class="sdl-btn-sub">${T.hq_quality_sub || 'Máxima nitidez — posibles cortes sutiles'}</span>
                            </div>
                            <span class="sdl-badge safe">${T.hq_quality_badge || 'RECOMENDADO'}</span>
                        </button>
                        <span class="sdl-tooltip">${T.hq_quality_tooltip || T.hq_tooltip}</span>
                        ${isLargeDoc ? `<p id="sdl-hq-toast" class="sdl-hq-toast" hidden></p>` : ''}
                    </div>

                    <div class="sdl-btn-container">
                        <button id="sdl-hq-fit-btn" class="sdl-btn sdl-btn-fit sdl-btn-twoline">
                            <div class="sdl-btn-body">
                                <span class="sdl-btn-title">${T.hq_fit_btn || 'Sin Cortes'}</span>
                                <span class="sdl-btn-sub">${T.hq_fit_sub || 'Sin interrupciones — imagen algo más pequeña'}</span>
                            </div>
                            <span class="sdl-badge">${T.hq_fit_badge || 'COMPATIBLE'}</span>
                        </button>
                        <span class="sdl-tooltip">${T.hq_fit_tooltip || ''}</span>
                    </div>

                    ${!isLargeDoc ? `
                    <div class="sdl-divider">${T.adv_opts}</div>

                    <div class="sdl-btn-container">
                        <button id="sdl-bridge-btn" class="sdl-btn sdl-btn-vector">
                            <span>${T.vec_btn}</span>
                            <span class="sdl-badge beta">${T.vec_badge}</span>
                        </button>
                        <span class="sdl-tooltip">${T.vec_tooltip}</span>
                    </div>` : ''}
                </div>
            `;
    }

    overlay.innerHTML = contentHtml;
    document.body.appendChild(overlay);

    // Handlers de los dos botones de escaneo
    const launchScan = (mode) => {
      const activeBtn = document.getElementById(mode === 'quality' ? 'sdl-hq-quality-btn' : 'sdl-hq-fit-btn');
      const otherBtn = document.getElementById(mode === 'quality' ? 'sdl-hq-fit-btn' : 'sdl-hq-quality-btn');

      const start = () => {
        if (activeBtn) activeBtn.classList.add('sdl-scanning');
        if (otherBtn) otherBtn.classList.add('sdl-btn-dimmed');
        executeHQScan(mode);
      };

      if (isLargeDoc) {
        const toast = document.getElementById('sdl-hq-toast');
        if (toast) { toast.textContent = T.hq_long_warning; toast.hidden = false; }
        setTimeout(start, 1800);
      } else {
        start();
      }
    };

    const qualityBtn = document.getElementById('sdl-hq-quality-btn');
    const fitBtn = document.getElementById('sdl-hq-fit-btn');
    if (qualityBtn) qualityBtn.onclick = () => launchScan('quality');
    if (fitBtn) fitBtn.onclick = () => launchScan('fit');

    // Botón de la vista no-embed (redirect a embed)
    const mainBtn = document.getElementById('sdl-action-btn');
    if (mainBtn && !isEmbed) {
      mainBtn.onclick = () => {
        window.location.href = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-1`;
      };
    }

    // Función compartida para lanzar la descarga de PDF original
    const launchBridgeDownload = async () => {
      let targetUrl = AppState.cachedUrl;
      if (!targetUrl) {
        const slug = sanitizeFilename(docName).replace(/_/g, '-').toLowerCase();
        targetUrl = `https://es.scribd.com/document/${docId}/${slug}`;
      }
      Utils.sendMessageAsync({ action: "open_external_downloader", docUrl: targetUrl, docName: docName });
    };

    const bridgeBtn = document.getElementById('sdl-bridge-btn');
    if (bridgeBtn) {
      // Solo existe cuando NO hay warning (documentos pequeños)
      bridgeBtn.onclick = launchBridgeDownload;
    }

    // El botón del banner de advertencia dispara la misma lógica de descarga
    // pero siempre existe (solo para documentos grandes).
    const warningPdfBtn = document.getElementById('sdl-warning-pdf-btn');
    if (warningPdfBtn) {
      warningPdfBtn.onclick = launchBridgeDownload;
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
    // Buscamos el botón activo por la clase .sdl-scanning que se asigna al lanzar.
    // Fallback a los IDs concretos para mantener compatibilidad.
    const btn = document.querySelector('#sdl-overlay .sdl-scanning')
      || document.getElementById('sdl-hq-quality-btn')
      || document.getElementById('sdl-action-btn');
    if (!btn) return;
    const titleEl = btn.querySelector('.sdl-btn-title') || btn.querySelector('span:first-child');
    if (titleEl) titleEl.innerText = text;
    if (state === 'loading') { btn.disabled = true; btn.style.cursor = 'wait'; }
    if (state === 'error') { btn.style.background = '#ef4444'; btn.disabled = false; btn.style.cursor = 'pointer'; }
    if (state === 'success') { btn.style.background = '#22c55e'; btn.classList.add('sdl-pulse-success'); btn.disabled = true; }
  },
  updateProgress: (percent, text) => {
    const fill = document.getElementById('sdl-progress-fill');
    const btn = document.querySelector('#sdl-overlay .sdl-scanning')
      || document.getElementById('sdl-hq-quality-btn')
      || document.getElementById('sdl-action-btn');
    if (fill) fill.style.width = `${percent}%`;
    if (text && btn) {
      const titleEl = btn.querySelector('.sdl-btn-title') || btn.querySelector('span:first-child');
      if (titleEl) titleEl.innerText = text;
    }
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
