/* Frontend configuration. Keep API paths in their page modules; configure only the host here. */
(() => {
  "use strict";
  const apiMeta = document.querySelector('meta[name="auroria-api-base"]');
  const currencyMeta = document.querySelector('meta[name="auroria-currency"]');
  const localeMeta = document.querySelector('meta[name="auroria-locale"]');
  const apiBaseUrl = (apiMeta?.content || "http://localhost:8080").trim().replace(/\/+$/, "");
  window.AURORIA_CONFIG = Object.freeze({
    apiBaseUrl,
    currency: (currencyMeta?.content || "NGN").trim().toUpperCase(),
    locale: (localeMeta?.content || "en-NG").trim()
  });
})();
