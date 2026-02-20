# 📄 Scribd Premium Downloader

![Version 2.4.0](https://img.shields.io/github/v/release/HugoAleOlguin/Scribd-Downloader-Premium?style=flat-square&color=0f766e)
![Status](https://img.shields.io/badge/status-active-success?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

Una suite de herramientas profesional para navegadores (Chromium/Firefox) diseñada para gestionar, respaldar y descargar documentos de Scribd.

## 📥 Descarga

Puedes descargar la última versión estable (ZIP) desde la página de Releases oficial:

[![Download Latest Release](https://img.shields.io/badge/Download-Latest_Release-0f766e?style=for-the-badge&logo=github)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/)

---

## ✨ Características

### 1. Escaneo Inteligente (HQ Mode)
Genera una copia de seguridad del documento capturando cada página como una imagen de alta resolución y ensamblándola en un PDF limpio.
- **Smart Zoom**: Optimización automática del viewport para asegurar la máxima calidad posible por página.
- **UI Cleaning**: Elimina automáticamente elementos distractores de la interfaz antes de procesar.
- **Totalmente Local**: Todo el procesamiento ocurre en tu navegador.

### 2. Capa Vectorial (Modo Automático)
Utiliza un sistema avanzado de automatización ("Autopilot") para conectar con servicios externos y recuperar el archivo PDF original (Vectorial/Texto) cuando está disponible.
- **Smart Validation**: Verifica la integridad del archivo antes de descargar (evita PDFs dañados/vacíos).
- **Detección de Enlaces**: Automatiza la búsqueda del endpoint de descarga.
- **Bypass de Espera**: Gestiona automáticamente los tiempos de espera y verificaciones de seguridad.

### 3. Soporte Internacional (v2.4)
- Interfaz completa traducida a **Español 🇪🇸** e **Inglés 🇺🇸**.
- Selector de idioma integrado en el popup.

---

## 🚀 Instalación en Modo Desarrollador

Esta extensión no está en la Web Store por motivos de política de contenido. Para instalarla:

### **Google Chrome, Brave, Edge, Opera**
1.  Descarga el código fuente (ZIP).
2.  Descomprime el archivo.
3.  Ve a `chrome://extensions/`.
4.  Activa el "Modo de desarrollador".
5.  Haz clic en "Cargar descomprimida" y selecciona la carpeta.

### **Mozilla Firefox**
1.  Descarga el código fuente (ZIP).
2.  Descomprime el archivo.
3.  **IMPORTANTE**: Renombra el archivo `manifest-firefox.json` a `manifest.json` (reemplazando el existente).
4.  Ve a `about:debugging#/runtime/this-firefox`.
5.  Haz clic en "Cargar complemento temporal...".
6.  Selecciona el archivo `manifest.json`.

---

## 🛠️ Uso

1.  Navega a cualquier documento de **Scribd**.
2.  La extensión detectará el documento y mostrará un panel de control flotante.
3.  Selecciona tu método preferido:
    *   **Escaneo Inteligente**: Recomendado para máxima compatibilidad.
    *   **PDF Original**: Recomendado para obtener texto seleccionable.

---

## ⚠️ Aviso Legal

Esta herramienta ha sido desarrollada exclusivamente con fines educativos y de investigación sobre la automatización de navegadores y manipulación del DOM.

El usuario es responsable del uso que le de a esta herramienta. No apoyamos la piratería ni la distribución ilegal de contenido protegido por derechos de autor. Utiliza esta herramienta solo para descargar documentos propios o de dominio público, o para realizar copias de seguridad personales (Fair Use).

---

## 👨‍💻 Autor

Desarrollado con ❤️ por **[HugoAleOlguin](https://github.com/HugoAleOlguin)**.
