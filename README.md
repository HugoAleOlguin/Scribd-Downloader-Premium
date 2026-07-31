<div align="center">

# 📄 Scribd Premium Downloader

**Save and back up Scribd documents directly from your browser.**  
No external accounts. No third-party servers. Everything runs 100% locally on your machine.

[![Version](https://img.shields.io/badge/version-2.9.0-0f766e?style=flat-square)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![Chrome](https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![Firefox](https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE.md)

<br/>

[![Download](https://img.shields.io/badge/⬇️_Download_v2.9.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)

🌐 [Leer en Español](README-español.md)

</div>

---

## What does it do?

Once installed, this extension adds a **floating panel** to every Scribd document page. From that panel, you can download the document using one of two methods:

| Mode | How it works | Output |
|------|-------------|--------|
| ⚡ **Extract from Server** | Reconstructs the exact raw document images natively from the server (Stitching enabled) | Highest 1:1 image-based PDF |
| 🖼️ **Secondary Scan** | Takes full-page screenshots by zooming out for documents failing Server extraction | Standard quality picture PDF |
| 🚀 **External Download** | Re-routes you to a 3rd party host that downloads the entire vector-PDF | Searchable vector PDF |

> ⚠️ This extension only works on **publicly accessible** documents on Scribd.

---

## ⚡ Installation

Don't worry — it's easier than it looks! Just follow these three steps.

---

### Step 1 — Download the extension

Click the button below to download the latest release as a ZIP file:

[![Download](https://img.shields.io/badge/⬇️_Download_v2.9.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.9.0)

Once downloaded, **extract (unzip) the folder** to a permanent location on your computer. For example:

```
C:\Extensions\scribd-downloader\
```

> 💡 **Important:** Don't move or delete this folder after installing. Your browser needs the files to stay in the same place — if you move them, the extension will stop working.

---

### Step 2 — Build the extension

Open the folder you just extracted and run the build script for your operating system:

- **Windows:** Double-click `build.bat`
- **Linux / macOS:** Run `bash build.sh` in your terminal

This script will automatically generate two ready-to-install folders:

```
scribd-downloader/
├── chrome/       ← 🔵 For Chrome, Edge, and Brave
├── firefox/      ← 🟠 For Firefox
└── ...
```

> ℹ️ If nothing happens when you run the script, ensure you have the necessary permissions (e.g., `chmod +x build.sh` on Linux).

---

### Step 3 — Load the extension into your browser

Pick your browser below and follow the steps:

#### 🔵 Chrome / Edge / Brave

1. Open a new tab and go to `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Toggle on **"Developer mode"** — it's a switch in the **top-right corner**
3. Click **"Load unpacked"**
4. Browse to the folder from Step 2 and select the **`chrome/`** subfolder

Your extension is now installed! You should see its icon in your browser toolbar.

#### 🟠 Firefox

1. Open a new tab and go to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Navigate to the folder from Step 2, open the **`firefox/`** subfolder, and select the **`manifest.json`** file

> ⚠️ **Firefox note:** Because the extension isn't signed through the Firefox Add-ons store, it gets removed every time you close the browser. You'll need to repeat Step 3 each time you open Firefox. This is a Firefox security limitation, not a bug.

---

## 🚀 How to use it

### ⚡ Extract from Server (Recommended)

This mode extracts the pure images directly from the servers to reconstruct a perfect, margin-less PDF, utilizing Smart Stitching for split pages.

```
1. Open any public document on scribd.com
2. The extension panel will appear on the screen
3. Click "Premium Extraction" or expand "Alternative option" -> "Extract from Server"
4. Wait — the extension will automatically trace and reconstruct each page natively
5. When it's done, your PDF will download automatically
```

### 🚀 External Download

This method tries to grab the original PDF file from a 3rd-party downloader tool.

```
1. Inside the viewer, expand "Alternative option" -> "External Download"
2. A new tab will open and bypass Cloudflare automatically
3. Wait 1 to 3 minutes for the process to complete
4. If a PDF was found, the download starts automatically
5. If it fails, just switch to Extract from Server instead
```

---

## 🔧 Troubleshooting

**The floating panel doesn't appear**  
→ Reload the page with `F5`. If the problem persists and you recently updated the extension, try re-running `build.bat` and reinstalling it from extensions settings.

**Firefox shows "empty add-on" error**  
→ Make sure you're selecting the `manifest.json` file inside the `firefox/` folder that was generated in Step 2 — not from any other location.

**External Download fails constantly**  
→ That specific document doesn't have a raw PDF available or the 3rd-party server went down. Use Extract from Server instead — it will always work for visible documents.

---

## 🏗️ For developers

Interested in contributing or modifying the extension? Here's how the project is structured:

```
scribd-downloader/
│
├── src/                   ← Edit your source files here
│   ├── shared/            ← Code shared by both browsers
│   │   ├── content.js     ← Floating panel UI + HQ Scan logic
│   │   ├── popup.html/js  ← Extension popup
│   │   ├── overlay.css    ← Panel styles
│   │   └── libs/          ← jsPDF, i18n helpers, shims
│   ├── chrome/
│   │   ├── manifest.json  ← Manifest v3 (service worker)
│   │   └── background.js  ← captureVisibleTab(null)
│   └── firefox/
│       ├── manifest.json  ← Manifest v2 (background scripts)
│       └── background.js  ← captureVisibleTab(windowId)
│
├── chrome/                ← Auto-generated by build.ps1 — do not edit
├── firefox/               ← Auto-generated by build.ps1 — do not edit
│
└── build.ps1              ← Build script: compiles src/ → chrome/ and firefox/
```

**Workflow:** Make your changes inside `src/`, then run `build.bat` to rebuild the installable folders. You can also run the build script from the terminal:

```bat
build.bat
```

---

## ⚠️ Legal disclaimer

This tool was built for **educational and research purposes only**. The author does not encourage or support the illegal distribution of copyrighted content.

You are **solely responsible** for how you use this extension. Only use it for documents you own, documents in the public domain, or in accordance with the copyright laws of your country.

---

<div align="center">

Made with ❤️ by **[HugoAleOlguin](https://github.com/HugoAleOlguin)**

[⭐ Star on GitHub](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium) · [🐛 Report a bug](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/issues) · [📋 Changelog](CHANGELOG.md)

</div>
