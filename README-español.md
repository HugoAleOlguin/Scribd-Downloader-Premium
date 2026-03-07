<div align="center">

# 📄 Scribd Premium Downloader

**Descarga y respalda documentos de Scribd directamente desde tu navegador.**  
Sin cuentas externas. Sin servidores de terceros. 100% local.

[![Versión](https://img.shields.io/badge/versión-2.9.0-0f766e?style=flat-square)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![Chrome](https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![Firefox](https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![Licencia](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)](LICENSE.md)

<br/>

[![Descargar](https://img.shields.io/badge/⬇️_Descargar_v2.9.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)

</div>

---

## ¿Qué hace?

Agrega un **panel flotante** en cada documento de Scribd con dos modos de descarga:

| Modo | Descripción | Resultado |
|------|-------------|-----------|
| ⚡ **Extraer del Servidor** | Descarga y fusiona las imágenes nativas 1:1 directo desde los servidores | PDF ultra-exacto de máxima calidad |
| 🖼️ **Escaneo Secundario** | Captura pantalla de cada página entera para evadir caídas del servidor | PDF imagen de calidad estándar |
| 🚀 **Descarga Externa** | Te enlaza a servicios 3ros para bajar el vector directo si existe | PDF con texto seleccionable |

> ⚠️ Solo funciona con documentos publicos.

---

## ⚡ Instalación rápida

### 1 — Descarga el proyecto

[Descarga el ZIP](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0) y descomprímelo en una carpeta permanente, por ejemplo:
```
C:\Extensiones\scribd-downloader\
```

> 💡 No muevas ni borres esta carpeta después de instalar. El navegador necesita que los archivos estén siempre en el mismo lugar.

---

### 2 — Ejecuta el build

Dentro de la carpeta descomprimida, haz **doble clic** sobre `build.bat`.

Esto genera automáticamente dos carpetas listas para instalar:

```
scribd-downloader/
├── chrome/       ← 🔵 Instala esta en Chrome, Edge, Brave
├── firefox/      ← 🟠 Instala esta en Firefox
└── ...
```

---

### 3 — Instala en tu navegador

#### 🔵 Chrome / Edge / Brave

1. Abre `chrome://extensions/` (o `edge://extensions/`)
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `chrome/` que se generó en el paso anterior

#### 🟠 Firefox

1. Abre `about:debugging#/runtime/this-firefox`
2. Haz clic en **"Cargar complemento temporal..."**
3. Navega a la carpeta `firefox/` y selecciona el archivo `manifest.json`

> **Nota Firefox:** La extensión se desactiva al cerrar el navegador. Repite el paso 3 cada vez que abras Firefox. Esta es una limitación de Firefox para extensiones no firmadas.

---

## 🚀 Uso

### Extraer Premium ✅ (Recomendado)

Este método es el más confiable, descarga matemáticamente todas las imágenes crudas de altísima calidad directamente de la fuente de datos. 

```
1. Abre un documento en scribd.com
2. Aparece el panel principal de la extensión.
3. Haz clic en "Extraer Premium" o en "Opciones Alternativas" -> "Extraer de Servidor"
4. La extensión comenzará a inyectar las descargas dentro de tu PDF
5. Al terminar, la descarga se iniciará automáticamente
```

### Descarga Externa 🚀

```
1. En el panel, expande "Opciones alternativas" y haz clic en "Descarga Externa"
2. Se abre una pestaña nueva y omite el Cloudflare por ti
3. Espera a que el servidor de terceros provea el link (1 a 3 minutos)
4. Si el PDF existe en sus bases de datos, inicia solo.
5. Si detecta fallos remotos, simplemente vuelve e intenta con "Extraer Premium".
```

---

## 🔧 Problemas comunes

**El panel flotante no aparece**
→ Recarga la página con `F5`. Si usaste un código muy viejo de extensión, regenera con el `build.bat` e instala de nuevo en las config. del navegador.

**Firefox muestra "complemento vacío"**  
→ Asegúrate de seleccionar el `manifest.json` dentro de la carpeta `firefox/` generada, no desde otra carpeta.

**La Descarga Externa siempre falla**  
→ El PDF de esa URL no está alojado en su base de datos gratuita de 3ros, o su web se cayó. Simplemente usa "Extraer Premium" del panel principal.

---

## 🏗️ Para desarrolladores

```
scribd-downloader/
│
├── src/                   ← código fuente (editar aquí)
│   ├── shared/            ← común a ambos navegadores
│   │   ├── content.js     ← overlay + lógica HQ Scan
│   │   ├── popup.html/js  ← popup de la extensión
│   │   ├── overlay.css    ← estilos del panel flotante
│   │   └── libs/          ← jsPDF, i18n, shim
│   ├── chrome/
│   │   ├── manifest.json  ← service_worker
│   │   └── background.js  ← captureVisibleTab(null)
│   └── firefox/
│       ├── manifest.json  ← background.scripts
│       └── background.js  ← captureVisibleTab(windowId)
│
├── chrome/                ← generado por build.bat (no editar)
├── firefox/               ← generado por build.bat (no editar)
│
└── build.bat              ← ensambla src/ → chrome/ y firefox/
```

**Para desarrollar:** edita los archivos en `src/`, luego haz doble clic en `build.bat` para regenerar las carpetas instalables.

También puedes correrlo desde consola:
```bat
build.bat
```

---

## ⚠️ Aviso legal

Desarrollado con fines **educativos y de investigación**. El usuario es el **único responsable** del uso que haga de esta herramienta. El autor no apoya la distribución ilegal de contenido con derechos de autor.

Úsala únicamente para documentos que te pertenecen, son de dominio público, o dentro del marco legal de tu país.

---

<div align="center">

Hecho con ❤️ por **[HugoAleOlguin](https://github.com/HugoAleOlguin)**

[⭐ Star en GitHub](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium) · [🐛 Reportar bug](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/issues) · [📋 Changelog](CHANGELOG.md)

</div>
