/**
 * Defers non-critical third-party tracking/analytics until after the page
 * has loaded and the browser has an opportunity to become idle.
 *
 * Keep this file dependency-free: it runs before the React bundle.
 */

(function () {
  "use strict";

  var loaded = false;

  function loadScript(src, id, onLoad) {
    if (document.getElementById(id)) return;

    var script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = onLoad || null;
    script.onerror = function () {
      // Third-party failures must never affect application startup.
      script.remove();
    };
    document.head.appendChild(script);
  }

  function installLightweightQueues() {
    // Preserve analytics calls made before the deferred scripts arrive.
    window.dataLayer = window.dataLayer || [];

    window.fbq =
      window.fbq ||
      function () {
        window.fbq.queue = window.fbq.queue || [];
        window.fbq.queue.push(arguments);
      };
    window.fbq.loaded = false;
    window.fbq.queue = window.fbq.queue || [];

    window.hj =
      window.hj ||
      function () {
        (window.hj.q = window.hj.q || []).push(arguments);
      };
    window.hj.q = window.hj.q || [];
  }

  function loadThirdPartyWidgets() {
    if (loaded) return;
    loaded = true;

    loadScript("/js/gtm.js", "campusconnect-third-party-gtm");
    loadScript("/js/fb-pixel.js", "campusconnect-third-party-facebook");
    loadScript("/js/hotjar.js", "campusconnect-third-party-hotjar");
  }

  function scheduleIdleLoad() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadThirdPartyWidgets, { timeout: 3000 });
      return;
    }

    window.setTimeout(loadThirdPartyWidgets, 2000);
  }

  installLightweightQueues();

  if (document.readyState === "complete") {
    scheduleIdleLoad();
  } else {
    window.addEventListener("load", scheduleIdleLoad, { once: true });
  }
})();
