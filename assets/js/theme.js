(function () {
  const storageKey = "qianyan-theme";
  const root = document.documentElement;
  const themeBtn = document.querySelector("[data-theme-toggle]");

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    if (themeBtn) {
      themeBtn.textContent = theme === "dark" ? "浅色" : "深色";
    }
  }

  const cached = localStorage.getItem(storageKey);
  const defaultTheme = cached || "light";
  applyTheme(defaultTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      const nowDark = root.getAttribute("data-theme") === "dark";
      const next = nowDark ? "light" : "dark";
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  }
})();
