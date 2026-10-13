(() => {
  const key = "whispr-theme";
  let notificationAudio = null;
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
  window.whisprUnlockAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return Promise.resolve(false);
      if (!notificationAudio) notificationAudio = new AudioContext();
      return notificationAudio.resume().then(() => true).catch(() => false);
    } catch (_) { return Promise.resolve(false); }
  };
  window.whisprBack = fallback => {
    const fallbackUrl = new URL(fallback || "enter/index.html", location.href);
    const safeFallback = fallbackUrl.origin === location.origin
      ? fallbackUrl.href
      : new URL("enter/index.html", location.href).href;
    let cameFromThisApp = false;
    try {
      const previous = new URL(document.referrer);
      const previousPage = previous.pathname.split("/").pop().toLowerCase();
      const authOrLandingPage = ["index/index.html", "login/index.html", "signup/index.html"].includes(previousPage);
      const isCurrentPage = previous.pathname === location.pathname;
      cameFromThisApp = previous.origin === location.origin && !authOrLandingPage && !isCurrentPage;
    } catch (_) {}

    if (cameFromThisApp && history.length > 1) history.back();
    else location.assign(safeFallback);
  };

  let saved = "dark";
  try { saved = localStorage.getItem(key) || "dark"; } catch (_) {}
  setTheme(saved === "light" ? "light" : "dark");
  window.whisprConfirm = (message, { title = "Please confirm", confirmText = "Continue", danger = false } = {}) => new Promise(resolve => {
    let overlay = document.getElementById("whisprDialog");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "whisprDialog";
      overlay.className = "whispr-dialog-backdrop";
      overlay.innerHTML = `<section class="whispr-dialog" role="dialog" aria-modal="true" aria-labelledby="whisprDialogTitle" aria-describedby="whisprDialogMessage"><h2 id="whisprDialogTitle"></h2><p id="whisprDialogMessage"></p><div class="whispr-dialog-actions"><button type="button" class="whispr-dialog-cancel">Cancel</button><button type="button" class="whispr-dialog-confirm"></button></div></section>`;
      document.body.appendChild(overlay);
    }
    const titleEl = overlay.querySelector("#whisprDialogTitle");
    const messageEl = overlay.querySelector("#whisprDialogMessage");
    const cancel = overlay.querySelector(".whispr-dialog-cancel");
    const confirm = overlay.querySelector(".whispr-dialog-confirm");
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirm.textContent = confirmText;
    confirm.classList.toggle("danger", danger);
    overlay.hidden = false;
    const previousFocus = document.activeElement;
    confirm.focus();
    const finish = value => {
      overlay.hidden = true;
      cancel.removeEventListener("click", onCancel);
      confirm.removeEventListener("click", onConfirm);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(value);
    };
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onBackdrop = event => { if (event.target === overlay) finish(false); };
    const onKeydown = event => { if (event.key === "Escape") finish(false); };
    cancel.addEventListener("click", onCancel);
    confirm.addEventListener("click", onConfirm);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });

  window.whisprNotify = (title, body = "", options = {}) => {
    let toast = document.getElementById("whisprToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "whisprToast";
      toast.className = "whispr-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = title;
    toast.appendChild(heading);
    if (body) {
      const detail = document.createElement("span");
      detail.textContent = body;
      toast.appendChild(detail);
    }
    toast.classList.add("show");
    clearTimeout(toast.hideTimer);
    toast.hideTimer = setTimeout(() => toast.classList.remove("show"), options.duration || 4200);

    try {
      if (localStorage.getItem("whispr-notification-sound") === "on" && !options.silent) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          if (!notificationAudio) notificationAudio = new AudioContext();
          const audio = notificationAudio;
          audio.resume().then(() => [0, 0.18].forEach((delay, index) => {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = index ? 740 : 620;
            gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + 0.16);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(audio.currentTime + delay);
            oscillator.stop(audio.currentTime + delay + 0.17);
          })).catch(() => {});
        }
      }
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, { body, tag: options.tag || "whispr-activity" });
        notification.onclick = () => { window.focus(); if (options.url) location.assign(options.url); notification.close(); };
      }
    } catch (_) {}
  };

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
