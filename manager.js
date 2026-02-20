// manager.js - The Brain v6.0
const statusEl = document.getElementById('status');
const fillEl = document.getElementById('fill');
const loaderEl = document.getElementById('loader');
const logEl = document.getElementById('log');

function log(msg, type = "info") {
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    if (type === 'error') div.className = 'error';
    logEl.prepend(div);
}

function setStatus(msg, percent) {
    statusEl.innerText = msg;
    if (typeof percent === 'number') fillEl.style.width = `${percent}%`;
}

let pdfDoc = null;
let targetTabId = null;

// Initialization
(async () => {
    try {
        log("Iniciando Manager v6...");
        const urlParams = new URLSearchParams(window.location.search);
        targetTabId = parseInt(urlParams.get('tabId'));

        if (!targetTabId) {
            setStatus("Error: ID de pestaña inválido.", 0);
            log("Falta ?tabId=XYZ en la URL", "error");
            return;
        }

        // Init PDF
        const { jsPDF } = window.jspdf;
        pdfDoc = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4', compress: true });
        pdfDoc.deletePage(1);

        loaderEl.style.display = 'block';
        setStatus("Conectando con Scribd...", 5);

        // Start Process via Background Relay (safest for cross-origin if direct fails)
        // Or direct message if content script is ready.
        // Let's retry connecting for 10s.

        let connected = false;
        for (let i = 0; i < 10; i++) {
            try {
                await sendMessageToTab(targetTabId, { action: "ping" });
                connected = true;
                break;
            } catch (e) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!connected) {
            // Maybe inject?
            log("No responde. Inyectando Content Script...", "error");
            await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                files: ['content.js']
            });
        }

        // Send Start Command
        log("Enviando comando START...");
        chrome.tabs.sendMessage(targetTabId, { action: "start_capture_v6" });

    } catch (e) {
        log("Error Init: " + e.message, "error");
    }
})();

// Listen for messages from Content Script (relayed or direct)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "page_captured") {
        processPage(msg);
    }
    else if (msg.action === "capture_complete") {
        finishPDF();
    }
    else if (msg.action === "log_error") {
        log("Remote: " + msg.error, "error");
    }
});

async function processPage(data) {
    // data.image (dataUrl), data.width, data.height, data.index, data.total
    try {
        const { image, width, height, index, total } = data;

        pdfDoc.addPage([width, height]);
        pdfDoc.addImage(image, 'JPEG', 0, 0, width, height, undefined, 'FAST');

        const percent = Math.round(((index) / total) * 100);
        setStatus(`Procesando página ${index}/${total}...`, percent);
        log(`Página ${index} añadida.`);

    } catch (e) {
        log("Error procesando página: " + e.message, "error");
    }
}

async function finishPDF() {
    setStatus("Generando archivo final...", 100);
    loaderEl.style.display = 'block';

    setTimeout(() => {
        try {
            const blob = pdfDoc.output('blob');
            const url = URL.createObjectURL(blob);

            log("Blob URL creado: " + url.substring(0, 50) + "...");

            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = `Scribd_Document_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();

            setStatus("✅ ¡Descarga Completa!", 100);
            loaderEl.style.display = 'none';
            document.getElementById('retryBtn').innerText = "Cerrar";
            document.getElementById('retryBtn').style.display = 'block';
            document.getElementById('retryBtn').onclick = () => window.close();

        } catch (e) {
            log("Error Final Save: " + e.message, "error");
            setStatus("Error al guardar PDF", 100);
        }
    }, 500); // Give UI time to update
}

function sendMessageToTab(tabId, msg) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, msg, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response);
        });
    });
}
