(() => {
  const key = "whispr-theme";
  const setTheme = theme => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch (_) {}
    const button = document.getElementById("themeToggle");
    if (button) {
      const light = theme === "light";
      button.setAttribute("aria-pressed", String(light));
      button.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
      button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${light ? "☾" : "☀"}</span><span>${light ? "Dark" : "Light"} theme</span>`;
    }
  };
  window.whisprBack = fallback => {
    const fallbackUrl = fallback || "enter.html";
    let cameFromThisApp = false;
    try {
      const previous = new URL(document.referrer);
      const previousPage = previous.pathname.split("/").pop().toLowerCase();
      const authOrLandingPage = ["index.html", "login.html", "signup.html"].includes(previousPage);
      cameFromThisApp = previous.origin === location.origin && !authOrLandingPage;
    } catch (_) {}

    if (cameFromThisApp && history.length > 1) history.back();
    else location.assign(fallbackUrl);
  };

  let saved = "dark";
  try { saved = localStorage.getItem(key) || "dark"; } catch (_) {}
  setTheme(saved === "light" ? "light" : "dark");
  const mount = () => {
    if (document.getElementById("themeToggle")) return;
    const button = document.createElement("button");
    button.id = "themeToggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
    document.body.appendChild(button);
    setTheme(document.documentElement.dataset.theme || "dark");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
