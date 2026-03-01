<div align="center">

# 📄 Scribd Premium Downloader

**Save and back up Scribd documents directly from your browser.**  
No external accounts. No third-party servers. Everything runs 100% locally on your machine.

[![Version](https://img.shields.io/badge/version-2.7.0-0f766e?style=flat-square)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.7.0)
[![Chrome](https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.7.0)
[![Firefox](https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.7.0)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE.md)

<br/>

[![Download](https://img.shields.io/badge/⬇️_Download_v2.7.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.7.0)

🌐 [Leer en Español](README-español.md)

</div>

---

## What does it do?

Once installed, this extension adds a **floating panel** to every Scribd document page. From that panel, you can download the document using one of two methods:

| Mode | How it works | Output |
|------|-------------|--------|
| 🖼️ **HQ Scan** | Captures each page as a screenshot and bundles them into a PDF | Image-based PDF · Works on virtually every document |
| 📄 **Original PDF** | Tries to find and download the raw vector PDF directly from Scribd's servers | Searchable, copy-able text PDF |

> ⚠️ This extension only works on **publicly accessible** documents on Scribd.

---

## ⚡ Installation

Don't worry — it's easier than it looks! Just follow these three steps.

---

### Step 1 — Download the extension

Click the button below to download the latest release as a ZIP file:

[![Download](https://img.shields.io/badge/⬇️_Download_v2.7.0-0f766e?style=for-the-badge)](https://github.com/HugoAleOlguin/Scribd-Downloader-Premium/releases/2.7.0)

Once downloaded, **extract (unzip) the folder** to a permanent location on your computer. For example:

```
C:\Extensions\scribd-downloader\
```

> 💡 **Important:** Don't move or delete this folder after installing. Your browser needs the files to stay in the same place — if you move them, the extension will stop working.

---

### Step 2 — Build the extension

Open the folder you just extracted and **double-click `build.bat`**.

This script will automatically generate two ready-to-install folders:

```
scribd-downloader/
├── chrome/       ← 🔵 For Chrome, Edge, and Brave
├── firefox/      ← 🟠 For Firefox
└── ...
```

> ℹ️ If nothing happens when you double-click, right-click `build.bat` and select **"Run as administrator"**.

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

### 🖼️ HQ Scan ✅ (Recommended)

This is the most reliable method. It works on almost any public document.

```
1. Open any public document on scribd.com
2. The extension panel will appear on the right side of the screen
3. Enable "Download Mode" and enter the document viewer
4. Click "SMART SCAN (HQ)"
5. Wait — the extension will automatically scroll and capture each page
6. When it's done, your PDF will download automatically
```

### 📄 Original PDF ⚡

This method tries to grab the original PDF file from Scribd's servers. It's faster when it works, but not all documents have one available.

```
1. Inside the viewer, click "ORIGINAL PDF"
2. A new tab will open and be controlled automatically — don't close it
3. Wait 1 to 3 minutes for the process to complete
4. If a PDF was found, the download starts automatically
5. If it fails, just switch to HQ Scan instead
```

---

## 🔧 Troubleshooting

**The floating panel doesn't appear**  
→ Reload the page with `F5`. If the problem persists and you recently updated the extension, try re-running `build.bat` and reinstalling it.

**Firefox shows "empty add-on" error**  
→ Make sure you're selecting the `manifest.json` file inside the `firefox/` folder that was generated in Step 2 — not from any other location.

**HQ Scan captures blank white pages**  
→ The document hasn't fully loaded yet. Scroll through all the pages once to let them load, then try scanning again.

**Original PDF always fails**  
→ That specific document doesn't have a raw PDF available on Scribd's servers. Use HQ Scan as an alternative — it will always work.

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
