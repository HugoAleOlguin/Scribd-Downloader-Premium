// shim.js
// Fake a CommonJS module environment so jsPDF attaches to it instead of failing window detection
window.module = { exports: {} };
window.exports = window.module.exports;
