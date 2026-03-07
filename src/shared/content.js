/**
 * Scribd Premium Downloader
 * Content Script with i18n
 * @version 2.9.0
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
      let result = "Scribd_Document";
      if (AppState.cachedName) result = AppState.cachedName;
      else {
        const specificTitle = document.querySelector('[data-e2e="doc_page_title"]');
        if (specificTitle && specificTitle.innerText.trim()) result = specificTitle.innerText;
        else {
          const embedTitle = document.querySelector('.title');
          if (embedTitle && embedTitle.innerText.trim()) result = embedTitle.innerText;
          else {
            let docTitle = document.title || "";
            result = docTitle.replace(/\| Scribd/gi, '').replace(/Lea en línea/gi, '').replace(/Scribd/gi, '');
          }
        }
      }
      result = sanitizeFilename(result);
      if (!result) return `Scribd_Document_${Date.now()}`;
      return result.substring(0, 120); // Prevenir error de límite de 255 caracteres en Windows
    } catch (e) { return `Scribd_Document_${Date.now()}`; }
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

          doc.addPage([sw, sh]);
          doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, sw, sh, undefined, 'FAST');
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
        const sw = rect.width; const sh = rect.height;
        doc.addPage([sw, sh]);

        let format = undefined;
        if (dataUrl.startsWith('data:image/jpeg')) format = 'JPEG';
        else if (dataUrl.startsWith('data:image/png')) format = 'PNG';
        else if (dataUrl.startsWith('data:image/webp')) format = 'WEBP';

        doc.addImage(dataUrl, format, 0, 0, sw, sh, undefined, 'FAST');
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

    // Ya no dividimos en lotes por pedido del usuario. Documento completo.
    const pdf = PDFHandler.init();

    // --- PAUSE SI LA PESTAÑA NO ESTÁ VISIBLE ---
    // Previene capturar la pestaña equivocada o colgar procesos de fondo
    const ensureVisible = async () => {
      if (!document.hidden) return;
      const prevBtn = document.querySelector('#sdl-overlay .sdl-scanning');
      const titleEl = prevBtn ? (prevBtn.querySelector('.sdl-btn-title') || prevBtn.querySelector('span:first-child')) : null;
      const prevText = titleEl ? titleEl.innerText : T.loading;

      Interface.updateState('loading', '⚠️ PAUSA - ¡Vuelve a esta pestaña!');
      document.title = "⚠️ PAUSA - Vuelve a la pestaña";

      await new Promise(resolve => {
        const handler = () => {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', handler);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', handler);
      });

      document.title = fname ? fname.substring(0, 20) : "Scribd Premium";
      Interface.updateState('loading', prevText);
      await new Promise(r => setTimeout(r, 600)); // tiempo para reflow/re-render
    };

    for (let i = 0; i < total; i++) {
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
      let pageW = firstRect.width;
      let pageH = firstRect.height;

      const overlay = document.getElementById('sdl-overlay');
      // No ocultamos la interfaz en modo nativo
      if (overlay && mode !== 'native') overlay.style.display = 'none';
      if (mode !== 'native') await new Promise(r => setTimeout(r, 100));

      await ensureVisible(); // Siempre asegurarse de que la pestaña está activa antes de iniciar trabajo pesado
      console.log(`[Native-Debug] ------- PÁGINA ${i + 1} START -------`);

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
      let currentMode = mode;

      // En modo nativo, si hay múltiples fragmentos de imágenes temporales,
      // descargamos tomando una captura "zoom-fit" (Escaneo Secundario automático)
      // para no mezclar capas y conseguir el documento correcto.
      if (currentMode === 'native') {
        const imgEls = Array.from(page.querySelectorAll('img.absimg, img[src*="html.scribdassets"], img.orig_image'));

        if (imgEls.length > 1) {
          console.log(`[Native-Debug] Página ${i + 1}: Layout complejo detectado (Múltiples Fragmentos = ${imgEls.length}). Auto-fallback a Escaneo Secundario.`);
          currentMode = 'fit';
        }
      }

      if (currentMode === 'native') {
        console.log(`[Native-Debug] Empieza procesamiento nativo de imagen única para la página ${i + 1}`);

        const imgEls = Array.from(page.querySelectorAll('img.absimg, img[src*="html.scribdassets"], img.orig_image'))
          .filter(img => img.getBoundingClientRect().width > 50 && img.getBoundingClientRect().height > 50);

        if (imgEls.length > 0) {
          const imgEl = imgEls[0];
          if (imgEl.src && imgEl.src.startsWith('http')) {
            console.log(`[Native-Debug] Pág ${i + 1}: Fetching URL = ${imgEl.src}`);
            await ensureVisible();

            const reqPromise = Utils.sendMessageAsync({ action: 'fetch_image', url: imgEl.src });
            const timeoutFetch = new Promise(resolve => setTimeout(() => resolve({ success: false, error: 'TIMEOUT_EN_BACKGROUND_FETCH' }), 10000));

            let req;
            try { req = await Promise.race([reqPromise, timeoutFetch]); }
            catch (e) { req = { success: false, error: e.message }; }

            if (req && req.success && req.data) {
              const imgLoadPromise = new Promise(r => {
                const tmpImg = new Image();
                let finished = false;
                const end = () => { if (!finished) { finished = true; r(tmpImg); } };
                tmpImg.onload = end;
                tmpImg.onerror = end;
                tmpImg.src = req.data;
                setTimeout(end, 5000);
              });

              const tmpImg = await imgLoadPromise;
              if (tmpImg && tmpImg.width > 0) {
                dataUrl = req.data;
                pageW = tmpImg.width;
                pageH = tmpImg.height;
                console.log(`[Native-Debug] Pág ${i + 1}: Nativa aplicada con éxito (${pageW}x${pageH}).`);
              }
            } else {
              console.error(`[Native-Debug] Pág ${i + 1}: Falló la descarga desde background.`);
            }
          }
        }

        // Si falló por lo que sea
        if (!dataUrl) {
          console.error(`[Native-Debug] 💥 FATAL Página ${i + 1}: No hay imagen. Inyectando canvas de error rojo para visualización en el PDF.`);
          const errCanvas = document.createElement('canvas');
          errCanvas.width = pageW;
          errCanvas.height = pageH;
          const ctx = errCanvas.getContext('2d');
          ctx.fillStyle = "#ffebee";
          ctx.fillRect(0, 0, pageW, pageH);
          ctx.fillStyle = "#d32f2f";
          ctx.font = "bold 30px Arial";
          ctx.textAlign = "center";
          ctx.fillText(`ERROR EN PÁGINA ${i + 1}`, pageW / 2, pageH / 2 - 20);
          dataUrl = errCanvas.toDataURL('image/png');
        }
      } else if (currentMode === 'fit') {
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

        await ensureVisible();
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
      console.log(`[Native-Debug] Pág ${i + 1}: Llamando a PDFHandler.addPageFromCanvas() con ${pageW}x${pageH}`);

      try {
        await PDFHandler.addPageFromCanvas(pdf, dataUrl, { width: pageW, height: pageH });
        console.log(`[Native-Debug] Pág ${i + 1}: jsPDF insertó la imagen.`);
      } catch (errPDF) {
        console.error(`[Native-Debug] Pág ${i + 1}: EXCEPCIÓN AL AÑADIR A jsPDF:`, errPDF);
      }

      const pct = Math.round(((i + 1) / total) * 100);
      Interface.updateProgress(pct, `${i + 1}/${total}`);
      console.log(`[Native-Debug] ------- PÁGINA ${i + 1} END -------`);
    }

    // Guardar el documento completo
    Interface.updateState('saving', T.saving);

    try {
      const b64 = pdf.output('datauristring');
      console.log("[Native-Debug] Enviando payload a background para descargar con chrome.downloads API.");
      const downloadCmd = await Utils.sendMessageAsync({ action: 'download_pdf', url: b64, filename: `${fname}.pdf` });

      if (!downloadCmd || !downloadCmd.success) {
        console.warn("[Native-Debug] Descarga nativa vía background falló. Fallback clásico de jsPDF.", downloadCmd?.error);
        pdf.save(`${fname}.pdf`);
      } else {
        console.log("[Native-Debug] Background confirmó el envío de descarga:", downloadCmd.id);
      }
    } catch (saveErr) {
      console.error("[Native-Debug] Fallback a pdf.save() nativo por error crítico:", saveErr);
      pdf.save(`${fname}.pdf`);
    }

    await new Promise(r => setTimeout(r, 800));

    Interface.updateState('success', T.success);

    // Cleanup: cerramos el keepalive y restauramos el estado de la página
    keepalivePort?.disconnect();
    resetZoom();
    document.body.style.overflow = originalOverflow || '';
    document.getElementById('spd-clean-style')?.remove();
    setTimeout(() => { AppState.isProcessing = false; document.getElementById('sdl-overlay')?.remove(); }, 5000);

  } catch (e) {
    console.error(`[Native-Debug] CRASH GLOBAL en executeHQScan:`, e);
    keepalivePort?.disconnect();
    resetZoom();
    document.body.style.overflow = originalOverflow || '';
    document.getElementById('spd-clean-style')?.remove();
    Interface.updateState('error', T.error + e.message);
    AppState.isProcessing = false;
    if (document.getElementById('sdl-overlay')) document.getElementById('sdl-overlay').style.display = 'flex';
  }
}

function sanitizeFilename(name) {
  return name.replace(/[\r\n]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s-_\u00C0-\u00FF]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

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

                    <!-- Modos de escaneo presentados como opciones claras -->
                    <div class="sdl-btn-container" style="margin-bottom: 8px;">
                        <button id="sdl-hq-native-btn" class="sdl-btn sdl-btn-primary sdl-btn-twoline" style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-color: #7c3aed;">
                            <div class="sdl-btn-body">
                                <span class="sdl-btn-title">${T.hq_native_btn || 'Alta Calidad'}</span>
                                <span class="sdl-btn-sub">${T.hq_native_sub || 'Sustrae la original'}</span>
                            </div>
                            <span class="sdl-badge safe" style="background: #a855f7;">${T.hq_native_badge || 'RECOMENDADO'}</span>
                        </button>
                        <span class="sdl-tooltip">${T.hq_native_tooltip || T.hq_tooltip}</span>
                    </div>

                    <div class="sdl-btn-container">
                        <button id="sdl-hq-fit-btn" class="sdl-btn sdl-btn-fit sdl-btn-twoline">
                            <div class="sdl-btn-body">
                                <span class="sdl-btn-title">${T.hq_fit_btn || 'Escaneo Secundario'}</span>
                                <span class="sdl-btn-sub">${T.hq_fit_sub || 'Sin interrupciones'}</span>
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
                
                <div id="sdl-feedback-container" style="display:none; text-align:center; margin-top:12px; font-size: 13px; color: #d1d5db; line-height: 1.4;"></div>
            `;
    }

    overlay.innerHTML = contentHtml;
    document.body.appendChild(overlay);

    // Handlers de los botones de escaneo
    const launchScan = (mode) => {
      const btnTypes = ['native', 'fit'];
      const activeBtn = document.getElementById(`sdl-hq-${mode}-btn`) || document.getElementById('sdl-hq-native-btn');

      const start = () => {
        AppState.activeMode = mode;
        btnTypes.forEach(m => {
          let btn = document.getElementById(`sdl-hq-${m}-btn`);
          if (btn) {
            if (m === mode) btn.classList.add('sdl-scanning');
            else btn.classList.add('sdl-btn-dimmed');
          }
        });
        executeHQScan(mode);
      };

      if (isLargeDoc) {
        const toast = document.getElementById('sdl-hq-toast');
        if (toast) { toast.textContent = T.hq_long_warning; toast.hidden = false; }
        // Se quitó el timeout artificial 
        start();
      } else {
        start();
      }
    };

    const nativeBtn = document.getElementById('sdl-hq-native-btn');
    const fitBtn = document.getElementById('sdl-hq-fit-btn');
    if (nativeBtn) nativeBtn.onclick = () => launchScan('native');
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
    const btn = document.querySelector('#sdl-overlay .sdl-scanning')
      || document.getElementById('sdl-hq-native-btn')
      || document.getElementById('sdl-action-btn');
    if (!btn) return;
    const titleEl = btn.querySelector('.sdl-btn-title') || btn.querySelector('span:first-child');
    if (titleEl) titleEl.innerText = text;

    const feedback = document.getElementById('sdl-feedback-container');
    const I18nSafe = window.I18n || { es: { overlay: {} }, en: { overlay: {} } };
    const T = (I18nSafe[AppState.language] && I18nSafe[AppState.language].overlay) ? I18nSafe[AppState.language].overlay : I18nSafe.es.overlay;

    if (state === 'loading') {
      btn.disabled = true; btn.style.cursor = 'wait';
      if (feedback && AppState.activeMode === 'native') {
        feedback.style.display = 'block';
        feedback.innerHTML = `
          <img src="https://i.ibb.co/JFt5vNL0/let-him-cook.jpg" style="width:100%; max-width:85px; border-radius:6px; margin-bottom: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.1);" alt="Let him cook">
          <div style="font-weight:600; color:#fff; margin-bottom:4px;">${T.feedback_pause || '⚠️ Manten la pestaña abierta'}</div>
          <div style="opacity:0.8; font-size:12px;">${T.feedback_desc || 'Asegúrate de no cerrar esta de fondo hasta que termine el proceso.'}</div>
        `;
      }
    }
    if (state === 'error') {
      btn.style.background = '#ef4444'; btn.disabled = false; btn.style.cursor = 'pointer';
      if (feedback && AppState.activeMode === 'native') {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(239, 68, 68, 0.1)';
        feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        feedback.style.padding = '10px';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = `
            <div style="color:#f87171; font-weight:600; margin-bottom:6px;">${T.feedback_err_title || '⚠️ La extracción se interrumpió'}</div>
            <div style="margin-bottom:8px; opacity:0.9;">${T.feedback_err_desc || 'Vuelve a intentarlo asegurándote de no cerrar la pestaña.'}</div>
            <div style="font-size:12px;">${T.feedback_err_help || 'Si el problema persiste: <a href="https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/issues" style="color:#60a5fa;" target="_blank">Repórtelo en Github</a>'}</div>
         `;
      }
    }
    if (state === 'success') {
      btn.style.background = '#22c55e'; btn.classList.add('sdl-pulse-success'); btn.disabled = true;
      if (feedback) feedback.style.display = 'none';
    }
  },
  updateProgress: (percent, text) => {
    const fill = document.getElementById('sdl-progress-fill');
    const btn = document.querySelector('#sdl-overlay .sdl-scanning')
      || document.getElementById('sdl-hq-native-btn')
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
