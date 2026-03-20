/**
 * key-interceptor.js
 * @world   MAIN  (corre en el contexto de la página, no en el aislado)
 * @run_at  document_start
 *
 * Intercepta los fetch/XHR que Scribd hace al cargar su lector (React).
 * Cuando detecta una petición al endpoint /embeds/ con access_key,
 * guarda el token en document.documentElement.dataset.sdlKey para que
 * el content script (mundo aislado) lo pueda leer.
 *
 * Por qué funciona:
 *   - Corre en document_start → antes de que el JS de Scribd haga cualquier petición
 *   - Corre en el mundo MAIN → puede parchear window.fetch y XMLHttpRequest
 *   - El atributo data-sdl-key en <html> es visible tanto en MAIN como en el mundo aislado
 */
(function interceptScribdRequests() {
    // Marcador: permite al content script verificar que este script corrió
    document.documentElement.setAttribute('data-sdl-interceptor', 'active');

    function captureKeyFromUrl(url) {
        if (!url) return;
        if (url.indexOf('/embeds/') === -1 || url.indexOf('access_key=') === -1) return;
        try {
            const qs  = url.indexOf('?') !== -1 ? url.split('?')[1] : '';
            const key = new URLSearchParams(qs).get('access_key');
            if (key && key.length >= 10) {
                document.documentElement.setAttribute('data-sdl-key', key);
            }
        } catch {}
    }

    // ── Parchear fetch ────────────────────────────────────────────────────
    if (typeof window.fetch === 'function') {
        const _fetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
            try {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                captureKeyFromUrl(url);
            } catch {}
            return _fetch(input, init);
        };
    }

    // ── Parchear XMLHttpRequest ───────────────────────────────────────────
    if (typeof XMLHttpRequest !== 'undefined') {
        const _open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            try { captureKeyFromUrl(typeof url === 'string' ? url : ''); } catch {}
            return _open.apply(this, arguments);
        };
    }

})();
