# 🗺️ Master Plan v3.0.0: The Vector-Perfect Renderer

> **AI Context:** You are an AI Agent tasked with upgrading the `Scribd Premium Downloader` from v2.9.0 to v3.0.0. The user’s core intent is to achieve **Vector-Perfect PDF quality** on any Scribd document, bypassing limitations of the current screenshot or raw-image fallback methods. 

## 1. El Problema Estructural Actual (v2.9.0)
Actualmente, nuestra extensión en `src/shared/content.js` resuelve la descarga leyendo las etiquetas `<img src="...">` (Modo Nativo) o tomando capturas de pantalla si detecta problemas. Esto acarrea una flaqueza irremediable que Scribd explota:
- **Text Layering Flotante:** Scribd renderiza textos nítidos sobre las páginas mediante capas HTML repletas de etiquetas `<span class="text_layer">`. Al descargar "solo la foto nativa", estos textos se pierden.
- **Mosaicos con `clip: rect()`:** Scribd divide las páginas grandes en hasta 15 pedazos de JPG que reensambla con CSS. El Modo Nativo actual, al no poder pegarlo sin perder la escala, lo aborta y hace *Fallback al "Escaneo Secundario"*.
- **La Penalización del Screenshot:** El método de fallback (Screenshot/Fit Mode) es el único que consigue mantener el texto SVG de los fragmentos porque "toma foto de la pantalla". Su problema: si el monitor del usuario tiene mala resolución, el PDF resultante se verá de baja resolución.

### El Archivo Maldito (Caso de Estudio)
- URL de Pruebas Extrema: [AngryBird Transformer Papercraft](https://es.scribd.com/doc/269724456/angrybird-transformer-papercraft)
- Tarea del Agente: Inspeccionar la `<div class="outer_page_container">` de la **hoja 2 o 3** de este documento para auditar la maraña de `spans` absolutos y el atributo CSS `transform: scale(0.2)` que esconde la magia visual.

---

## 2. La Misión (Arquitectura v3.0.0)

El objetivo central **no es reinventar el framework local actual**, sino inyectar una Renderizadora Canvas Virtual de HTML/CSS interna.
Buscaremos una reconstrucción fotográfica idéntica al DOM a nivel código sin importar la tarjeta gráfica ni la resolución del usuario.

### Las 2 Vías Tecnológicas a Investigar:

#### A) Renderizadores de Terceros Open Source (Recomendada)
- Las bibliotecas clásicas como **`html2canvas`** o su heredera moderna **`dom-to-image`** (o `modern-screenshot`).
- Funcionamiento teórico: Recorremos `.outer_page_container`, localizamos la `.newpage` y le aplicamos `html2canvas(elementoDOM, { scale: 3, useCORS: true })`.
- Resultado esperado: La librería lee los JPG de fondo, el `clip-path` y todos los textos SVG, devolviéndonos una estructura Canvas de altísima calidad que pasaremos asicrónamente por nuestro sistema `jsPDF` actual.

#### B) SVG DOM Cloner (Extracción profunda vectorial)
- Extraer el nodo HTML original, inyectarlo en un bloque `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>` y renderizarlo en un blob asíncrono. Esta técnica genera un documento perfecto pero Scribd podría tener problemas por uso de estilos externos complejos (hojas del servidor).

⚠️ **Instrucción crítica para el Agente que asuma este rol:**
Dedica el 60% de tu tiempo a abrir `browser_subagent` sobre el documento de los AngryBirds y ejecutar `html2canvas` mediante la consola web del navegador (`execute_browser_javascript`) sobre una `.outer_page_container` entera. Analiza los resultados binarios antes de empezar a programar sobre el proyecto local.

---

## 3. Estado de la Infraestructura en el Repositorio

Tu trabajo no debe descuidar los avances que la UI y la inyección actual implementan en los repositorios locales del usuario. El stack actual a repasar y respetar es:
- **`src/shared/content.js`:** Toda la maquinaria y el *Autopilot* que maneja el paso de página a página y progreso del UI. Deberás sustituir solamente la lógica central de la función de `mode === 'native'` y abolir, si lograste el éxito, la existencia del `Secondary Scan (fit)` en el DOM y traducciones.
- **`src/chrome/background.js`:** No tocarlo, allí reside el conducto maestro de salvavidas que delega y gestiona los bloqueos del API masivo de Blob. Soportará las descargas inmensas que logres con tu canvas unificado de alta resolución.
- **La Página Scribd vDownloaders:** (`https://scribd.vdownloaders.com/`) Nuestra 3ra opción del menú y el "Autopilot". No toques esto.

## 4. Requerimientos de Código Inteligente

Cuando te encuentres decidiendo cómo implementar la versión v3.0.0 en el `content.js`:
1. **Evitar las OOM (Out of Memory):** Las hojas de un Canvas virtual pesarán muchísimo. Deberás depurar el DOM intermedio con `canvas.width = 0` y forzar al garbage collector antes de procesar la siguiente hoja.
2. **Respetar los Temporizadores (Timeouts):** Continúa usando Promesas y timeouts estrictos de 5000 a 10000ms. Si una hoja es imposible de renderizar vectorialmente, el failsafe debe inyectar un canvas rojo de advertencia y seguir. La herramienta jamás debe atascarse infinitamente.

¡El resultado de tu desarrollo debe conseguir atrapar hasta la última letra escondida por Scribd en un PDF ultraligero y perfectamente armónico en resolución!
