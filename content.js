(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    buttonStyle: "glass",
    buttonOffset: 14,
    triggerHeight: 70,
    timeout: 2500
  };

  const BUTTON_SIZE = 46;
  const BUTTON_SAFETY = 12;

  let settings = { ...DEFAULTS };
  let overlay = null;
  let button = null;
  let sensor = null;
  let mouseX = 0;
  let mouseY = 9999;
  let mouseInActiveZone = false;
  let buttonVisible = false;
  let hideTimer = null;
  let leaveTimer = null;

  function getMinimumTriggerHeight() {
    return Number(settings.buttonOffset) + BUTTON_SIZE + BUTTON_SAFETY;
  }

  function getTriggerHeight() {
    return Math.max(Number(settings.triggerHeight), getMinimumTriggerHeight());
  }

  function isFullscreenActive() {
    return Boolean(
      document.fullscreenElement ||
      window.fullScreen ||
      (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches)
    );
  }

  function getDeepestActiveTarget() {
    const fs = document.fullscreenElement;
    if (!fs) {
      return document.body || document.documentElement;
    }

    // 1. If it's a raw video tag, use its parent or document root
    if (fs instanceof HTMLVideoElement) {
      return fs.parentElement || document.body || document.documentElement;
    }

    // 2. If it's an iframe, keep overlay in parent document top layer
    if (fs instanceof HTMLIFrameElement || !fs.appendChild) {
      return document.body || document.documentElement;
    }

    // 3. If it has an open shadow root (e.g. Reddit shreddit-player, custom web components), inject inside shadow tree
    if (fs.shadowRoot && typeof fs.shadowRoot.appendChild === "function") {
      const innerContainer = fs.shadowRoot.querySelector(".player-container, [part='container'], .video-player") || fs.shadowRoot;
      return innerContainer;
    }

    return fs;
  }

  function ensureShadowRootStyles(target) {
    if (!target) return;
    const root = target instanceof ShadowRoot ? target : (typeof target.getRootNode === "function" ? target.getRootNode() : null);
    if (root && root instanceof ShadowRoot && root.querySelector) {
      if (!root.querySelector("link[data-chromium-fs-style], style[data-chromium-fs-style]")) {
        try {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = browser.runtime.getURL("style.css");
          link.setAttribute("data-chromium-fs-style", "true");
          root.appendChild(link);
        } catch {}
      }
    }
  }

  async function loadSettings() {
    try {
      const stored = await browser.storage.local.get(DEFAULTS);
      settings = { ...DEFAULTS, ...stored };
      updateButtonPosition();
      updateButtonStyle();
      fullscreenChanged();
    } catch {
      settings = { ...DEFAULTS };
    }
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(changes)) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        settings[key] = changes[key].newValue;
      }
    }
    updateButtonPosition();
    updateButtonStyle();
    if (!settings.enabled) {
      hideButton();
      return;
    }
    if (isFullscreenActive()) {
      updateMouseZone();
    }
  });

  function createButton() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "firefox-fullscreen-exit-overlay";

    button = document.createElement("button");
    button.id = "firefox-fullscreen-exit-button";
    button.type = "button";
    button.setAttribute("aria-label", "Exit fullscreen");
    button.title = "Exit fullscreen";

    overlay.appendChild(button);

    sensor = document.createElement("div");
    sensor.id = "firefox-fullscreen-exit-sensor";
    sensor.style.height = `${getTriggerHeight()}px`;

    sensor.addEventListener("mousemove", event => {
      if (!isFullscreenActive() || !overlay || !settings.enabled) return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      updateMouseZone();
    });

    sensor.addEventListener("mouseleave", () => {
      if (!isFullscreenActive()) return;
      if (button && button.matches(":hover")) return;
      mouseY = 9999;
      updateMouseZone();
    });

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      // If in HTML5 video/element fullscreen, ONLY exit element fullscreen without touching browser window size
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (window.fullScreen || (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches)) {
        // Only trigger window-level exit if we are in browser F11 fullscreen
        browser.runtime.sendMessage({ action: "exit_window_fullscreen" }).catch(() => {});
      }
    });

    button.addEventListener("mouseenter", () => {
      if (!isFullscreenActive() || !settings.enabled) return;
      mouseInActiveZone = true;
      cancelTimers();
    });

    button.addEventListener("mouseleave", () => {
      if (!isFullscreenActive()) return;
      updateMouseZone();
    });

    updateButtonPosition();
    updateButtonStyle();
  }

  function updateButtonPosition() {
    if (!button) return;
    button.style.setProperty("--button-offset", `${Number(settings.buttonOffset)}px`);
    if (sensor) {
      sensor.style.height = `${getTriggerHeight()}px`;
    }
  }

  function updateButtonStyle() {
    if (!button) return;
    button.setAttribute("data-style", settings.buttonStyle || "glass");
  }

  function removeButton() {
    if (overlay) overlay.remove();
    if (sensor) sensor.remove();
    overlay = null;
    button = null;
    sensor = null;
    buttonVisible = false;
    mouseInActiveZone = false;
    cancelTimers();
  }

  function cancelTimers() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  }

  function showButton() {
    if (!overlay || !settings.enabled) return;
    cancelTimers();
    if (buttonVisible) return;

    buttonVisible = true;
    overlay.classList.remove("hiding");
    void overlay.offsetWidth;
    overlay.classList.add("show");

    hideTimer = setTimeout(() => {
      hideButton();
    }, Number(settings.timeout));
  }

  function hideButton() {
    if (!overlay || !buttonVisible) return;
    cancelTimers();
    buttonVisible = false;
    overlay.classList.remove("show");
    overlay.classList.add("hiding");
  }

  function updateMouseZone() {
    if (!isFullscreenActive() || !overlay || !settings.enabled) {
      mouseInActiveZone = false;
      return;
    }

    const triggerHeight = getTriggerHeight();
    const inTopArea = mouseY <= triggerHeight;
    const overButton = button && button.matches(":hover");
    const active = inTopArea || overButton;
    const previous = mouseInActiveZone;

    mouseInActiveZone = active;

    if (active && !previous) {
      cancelTimers();
      showButton();
      return;
    }

    if (!active && previous) {
      scheduleHideAfterLeave();
    }
  }

  function scheduleHideAfterLeave() {
    if (!overlay || !buttonVisible) return;
    if (leaveTimer) clearTimeout(leaveTimer);

    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      updateMouseZone();
      if (mouseInActiveZone) return;
      hideButton();
    }, 120);
  }

  document.addEventListener("mousemove", event => {
    if (!isFullscreenActive() || !overlay || !settings.enabled) return;
    mouseX = event.clientX;
    mouseY = event.clientY;
    updateMouseZone();
  }, true);

  function attachOverlay() {
    if (!overlay || !isFullscreenActive() || !settings.enabled) return;
    const target = getDeepestActiveTarget();
    if (!target) return;

    if (!target.contains(overlay)) {
      try {
        ensureShadowRootStyles(target);
        target.appendChild(overlay);
      } catch {
        try {
          (document.body || document.documentElement).appendChild(overlay);
        } catch {}
      }
    }

    if (sensor && !target.contains(sensor)) {
      try {
        target.appendChild(sensor);
      } catch {
        try {
          (document.body || document.documentElement).appendChild(sensor);
        } catch {}
      }
    }
  }

  function fullscreenChanged() {
    const active = isFullscreenActive();

    if (!active) {
      removeButton();
      mouseInActiveZone = false;
      mouseY = 9999;
      return;
    }

    if (!settings.enabled) {
      removeButton();
      return;
    }

    createButton();
    attachOverlay();

    overlay.classList.remove("show");
    overlay.classList.remove("hiding");
    buttonVisible = false;

    updateMouseZone();
  }

  document.addEventListener("fullscreenchange", fullscreenChanged);
  window.addEventListener("resize", fullscreenChanged);

  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(display-mode: fullscreen)");
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", fullscreenChanged);
    }
  }

  loadSettings();
})();