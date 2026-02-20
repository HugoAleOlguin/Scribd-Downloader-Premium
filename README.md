<div align="center">

# 📄 Scribd Premium Downloader

**Descarga y respalda documentos de Scribd directamente desde tu navegador.**  
Sin cuentas externas. Sin servidores de terceros. 100% local.

[![Versión](https://img.shields.io/badge/versión-2.5.0-0f766e?style=flat-square)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Chrome](https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Firefox](https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Licencia](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)](LICENSE.md)

<br/>

[![Descargar última versión](https://img.shields.io/badge/⬇️_Descargar_v2.5.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/tag/1.4.0/)

</div>

---

## ¿Qué es esto?

Una extensión de navegador que agrega un **panel de control flotante** en cada documento de Scribd, dándote acceso a dos métodos de descarga:

| Método | ¿Qué hace? | Resultado |
|--------|-----------|-----------|
| **Escaneo HQ** | Captura cada página del documento como imagen de alta resolución y las ensambla en un PDF | PDF tipo imagen · Alta compatibilidad |
| **PDF Original** | Intenta recuperar el archivo PDF vectorial original del servidor de Scribd | PDF con texto seleccionable · Requiere que el doc esté disponible |

> ⚠️ La extensión funciona **solo con documentos que puedes leer** en tu cuenta de Scribd. No desbloquea contenido al que no tienes acceso.

---

## Características

- 🖼️ **Escaneo HQ** — Genera un PDF a partir de capturas de pantalla. Funciona en prácticamente todos los documentos.
- 📄 **PDF Original (Autopilot)** — Automatiza la búsqueda del PDF vectorial en servicios externos. Incluye soporte para Cloudflare.
- 🌐 **Bilingüe** — Interfaz en **Español** e **Inglés** con selector de idioma en el popup.
- 🔒 **Privado** — Todo el procesamiento ocurre en tu navegador. No se envían datos a ningún servidor externo.
- 🦊 **Multi-navegador** — Compatible con Chrome, Edge, Brave, Opera y Firefox.

---

## 📥 Instalación

> La extensión **no está en ninguna tienda oficial** por razones de política de contenido. Debe instalarse manualmente en modo desarrollador. El proceso tarda menos de **2 minutos**.

### Paso 1 — Descargar

Descarga el ZIP con la última versión:

👉 **[Descargar Scribd Premium Downloader v2.5.0](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/tag/1.4.0/)**

Descomprime el archivo en una carpeta permanente (por ejemplo `Documentos/Extensiones/scribd-downloader`).

> 💡 **No borres ni muevas la carpeta después de instalar.** El navegador necesita que los archivos estén en el mismo lugar para cargarse correctamente.

---

### � Instalación en Chrome, Edge, Brave u Opera

1. Abre tu navegador y ve a la página de extensiones:
   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Brave:** `brave://extensions/`
   - **Opera:** `opera://extensions/`

2. Activa el **"Modo de desarrollador"** (interruptor en la esquina superior derecha).

3. Haz clic en **"Cargar descomprimida"** (o *"Load unpacked"*).

4. Selecciona la carpeta **`dist/chrome/`** dentro del ZIP que descomprimiste.

5. ¡Listo! Verás el icono de la extensión en la barra de herramientas. 🎉

---

### 🟠 Instalación en Firefox

Firefox requiere un procedimiento ligeramente diferente porque las extensiones temporales no persisten entre reinicios. Para mantenerla activa necesitas cargarla cada vez que abras Firefox, o usar un perfil de desarrollador.

1. Ejecuta el script de instalación incluido en el ZIP:
   - **Click derecho** sobre `build.ps1` → **"Ejecutar con PowerShell"**
   - Esto genera automáticamente la carpeta `dist/firefox/`

2. Abre Firefox y ve a:
   ```
   about:debugging#/runtime/this-firefox
   ```

3. Haz clic en **"Cargar complemento temporal..."**.

4. Navega a la carpeta `dist/firefox/` y selecciona el archivo `manifest.json`.

5. ¡Listo! La extensión aparecerá en la barra de herramientas. 🦊

> **Nota para Firefox:** La extensión se desactiva al cerrar el navegador. Debes repetir el paso 4 cada vez. Esta limitación es de Firefox para extensiones no firmadas por su tienda oficial.

---

## � Cómo usar la extensión

### Método 1 — Escaneo Inteligente (HQ) ✅ Recomendado

Es el método más confiable. Funciona en cualquier documento que puedas ver en pantalla.

```
1. Abre un documento en scribd.com
2. Espera a que aparezca el panel flotante de la extensión (esquina inferior-izquierda)
3. Haz clic en el botón "ACTIVAR MODO DESCARGA"
4. La página redirigirá al visor embebido del documento
5. En el visor, haz clic en "ESCANEO INTELIGENTE (HQ)"
6. La extensión tomará capturas automáticas de cada página
7. Cuando termine, se descargará el PDF automáticamente
```

> ⏱️ El tiempo varía según la cantidad de páginas. Un documento de 100 páginas tarda aproximadamente 3-5 minutos.

---

### Método 2 — PDF Original (Autopilot) ⚡ Avanzado

Intenta descargar el PDF vectorial original (con texto seleccionable y búsqueda). No siempre funciona — depende de si el documento original está disponible en el servidor.

```
1. En el visor embebido, haz clic en "PDF ORIGINAL"
2. Se abrirá una nueva pestaña con un servicio externo
3. La extensión rellenará automáticamente el formulario
4. Espera mientras se procesa (puede tardar 1-3 minutos)
5. Si el PDF existe, la descarga comenzará automáticamente
6. Si falla, usa el Método 1 como alternativa
```

---

## 🔧 Resolución de problemas

### El panel flotante no aparece en la página
- Verifica que estás en `scribd.com` (no en una URL diferente).
- Recarga la página con `F5`.
- Ve a la página de extensiones y asegúrate de que esté **habilitada**.
- Si actualizaste la extensión recientemente, haz clic en el botón de **recargar** (🔄) en la página de extensiones.

### El Escaneo HQ solo captura páginas en blanco
- Asegúrate de que el documento haya cargado completamente antes de iniciar el escaneo.
- Desactiva otras extensiones que puedan interferir (bloqueadores de anuncios agresivos, etc.).
- Prueba en una ventana de incógnito.

### El PDF Original siempre falla
- Este método depende de un servicio externo. Si el servidor no tiene el PDF, no hay forma de descargarlo.
- Usa el **Escaneo HQ** como alternativa — funciona en el ~99% de los casos.

### Error en Firefox: "background.service_worker is currently disabled"
- Estás usando los archivos de Chrome en Firefox. Asegúrate de cargar la carpeta **`dist/firefox/`**, no `dist/chrome/`.

### La extensión se desactivó sola (Firefox)
- Firefox desactiva las extensiones temporales al cerrarse. Vuelve a cargarla en `about:debugging`.

---

## 🏗️ Estructura del proyecto (para desarrolladores)

```
scribd-downloader/
├── shared/              ← Código compartido entre navegadores
│   ├── content.js       ← Overlay + lógica del Escaneo HQ
│   ├── popup.html/js    ← Interfaz del popup (selector de idioma)
│   ├── overlay.css      ← Estilos del panel flotante
│   └── libs/            ← jsPDF, i18n, shim
├── chrome/
│   ├── manifest.json    ← Configuración Chrome (service_worker)
│   └── background.js    ← Lógica de fondo para Chrome
├── firefox/
│   ├── manifest.json    ← Configuración Firefox (background.scripts)
│   └── background.js    ← Lógica de fondo para Firefox
├── build.ps1            ← Script de ensamblaje
└── dist/                ← Paquetes listos (generados por build.ps1)
    ├── chrome/
    └── firefox/
```

Para generar los paquetes de instalación desde el código fuente:
```powershell
# Click derecho en build.ps1 > Ejecutar con PowerShell
# O desde terminal:
powershell -ExecutionPolicy Bypass -File build.ps1
```

---

## ❓ Preguntas frecuentes

**¿Es ilegal usar esta extensión?**  
Depende de tu país y del uso que le des. Descargar contenido con derechos de autor para uso personal (copia de seguridad) está permitido en muchas jurisdicciones bajo el principio de *Fair Use*. Consulta las leyes de tu país. El autor no se hace responsable del uso que le des a la herramienta.

**¿Mis datos están seguros?**  
Sí. La extensión no envía ningún dato a servidores externos. Todo el procesamiento del Escaneo HQ ocurre en tu propia máquina. El PDF Original usa un servicio de terceros (*vDownloaders*) solo como intermediario de descarga.

**¿Por qué no está en la Chrome Web Store?**  
Google no permite extensiones que automaticen descargas de plataformas de contenido. Es más fácil distribuirla directamente.

**¿Puedo contribuir al proyecto?**  
¡Sí! Abre un *Issue* o *Pull Request* en GitHub. El código está bien estructurado y comentado.

**¿Funciona en mobile?**  
No. Las extensiones de navegador no están disponibles en versiones móviles de Chrome o Firefox (con la excepción de Firefox para Android, que tiene soporte limitado).

---

## ⚠️ Aviso legal

Esta herramienta fue desarrollada con fines **educativos y de investigación** sobre automatización de navegadores y manipulación del DOM.

El usuario es **el único responsable** del uso que haga de esta herramienta. El autor **no apoya** la piratería ni la distribución ilegal de contenido protegido por derechos de autor.

Utiliza esta herramienta únicamente para:
- Crear copias de seguridad personales de documentos que te pertenecen o que compraste
- Documentos de dominio público
- Usos dentro del marco legal de tu jurisdicción

---

<div align="center">

Hecho con ❤️ por **[HugoAleOlguin](https://github.com/HugoAleOlguin)**

[⭐ Dale una estrella en GitHub](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium) · [🐛 Reportar un bug](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/issues) · [📋 Ver cambios](CHANGELOG.md)

</div>
