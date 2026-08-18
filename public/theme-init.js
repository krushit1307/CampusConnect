(function () {
  try {
    var stored = localStorage.getItem("campusconnect-theme");
    var isHighContrast =
      stored === "high-contrast" ||
      (stored === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-contrast: more)").matches);

    var isDark =
      stored === "dark" ||
      ((!stored || stored === "system") &&
        !isHighContrast &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isHighContrast) {
      document.documentElement.classList.add("high-contrast", "dark");
      document.documentElement.style.colorScheme = "dark";
    } else if (isDark) {
      document.documentElement.classList.remove("high-contrast");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("high-contrast", "dark");
      document.documentElement.style.colorScheme = "light";
    }
  } catch (e) {
    // Fallback gracefully
  }
})();
