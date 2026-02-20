<div align="center">

# 📄 Scribd Premium Downloader

**Descarga y respalda documentos de Scribd directamente desde tu navegador.**  
Sin cuentas externas. Sin servidores de terceros. 100% local.

[![Versión](https://img.shields.io/badge/versión-2.5.1-0f766e?style=flat-square)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Chrome](https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Firefox](https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)
[![Licencia](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)](LICENSE.md)

<br/>

[![Descargar](https://img.shields.io/badge/⬇️_Descargar_v2.5.1-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)

</div>

---

## ¿Qué hace?

Agrega un **panel flotante** en cada documento de Scribd con dos modos de descarga:

| Modo | Descripción | Resultado |
|------|-------------|-----------|
| 🖼️ **Escaneo HQ** | Captura cada página y genera un PDF | PDF imagen · Alta compatibilidad |
| 📄 **PDF Original** | Busca y descarga el PDF vectorial del servidor | PDF con texto seleccionable |

> ⚠️ Solo funciona con documentos que ya puedes leer en tu cuenta de Scribd.

---

## ⚡ Instalación rápida

### 1 — Descarga el proyecto

Descarga el ZIP y descomprímelo en una carpeta permanente, por ejemplo:
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

### Escaneo HQ ✅ (recomendado)

```
1. Abre un documento en scribd.com
2. Aparece el panel flotante de la extensión
3. Activa el "Modo Descarga" y accede al visor
4. Haz clic en "ESCANEO INTELIGENTE (HQ)"
5. La extensión captura cada página automáticamente
6. Al terminar, se descarga el PDF
```

### PDF Original ⚡

```
1. En el visor, haz clic en "PDF ORIGINAL"
2. Se abre una pestaña que se controla automáticamente
3. Espera el resultado (1-3 minutos)
4. Si el PDF existe, la descarga inicia sola
5. Si falla, usa el Escaneo HQ como alternativa
```

---

## 🔧 Problemas comunes

**El panel flotante no aparece**
→ Recarga la página con `F5`. Si usaste el ZIP viejo, regenera con `build.ps1`.

**Firefox muestra "complemento vacío"**  
→ Asegúrate de seleccionar el `manifest.json` dentro de la carpeta `firefox/` generada, no desde otra carpeta.

**El Escaneo HQ captura páginas en blanco**  
→ El documento no terminó de cargar. Espera unos seconds y vuelve a intentarlo.

**El PDF Original siempre falla**  
→ El PDF vectorial no está disponible en el servidor externo. Usa el Escaneo HQ.

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
├── chrome/                ← generado por build.ps1 (no editar)
├── firefox/               ← generado por build.ps1 (no editar)
│
└── build.ps1              ← ensambla src/ → chrome/ y firefox/
```

**Para desarrollar:** edita los archivos en `src/`, luego haz doble clic en `build.bat` para regenerar las carpetas instalables.

También puedes correrlo desde consola:
```bat
build.bat
```

---

## ❓ Preguntas frecuentes

**¿Por qué no está en la Web Store?**  
Google y Mozilla no permiten extensiones que automaticen descargas de plataformas de contenido. Se distribuye manualmente.

**¿Es seguro ejecutar el `.ps1`?**  
Sí. Es un script de PowerShell de ~30 líneas que solo copia archivos de `src/` a `chrome/` y `firefox/`. Puedes abrirlo con el Bloc de Notas y verificarlo antes de ejecutarlo.

**¿Mis datos están seguros?**  
Todo el procesamiento ocurre en tu máquina local. No se envían datos a ningún servidor externo.

**¿Funciona en móvil?**  
No. Las extensiones no están disponibles en Chrome para Android ni en Firefox para iOS.

**¿Cómo actualizo?**  
Descarga el ZIP nuevo, reemplaza los archivos, y vuelve a ejecutar `build.ps1`. Luego recarga la extensión en el navegador.

---

## ⚠️ Aviso legal

Desarrollado con fines **educativos y de investigación**. El usuario es el **único responsable** del uso que haga de esta herramienta. El autor no apoya la distribución ilegal de contenido con derechos de autor.

Úsala únicamente para documentos que te pertenecen, son de dominio público, o dentro del marco legal de tu país.

---

<div align="center">

Hecho con ❤️ por **[HugoAleOlguin](https://github.com/HugoAleOlguin)**

[⭐ Star en GitHub](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium) · [🐛 Reportar bug](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/issues) · [📋 Changelog](CHANGELOG.md)

</div>
