(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    buttonStyle: "solid",
    buttonOffset: 60,
    triggerHeight: 8,
    triggerWidth: 100,
    timeout: 3500
  };

  const BUTTON_SIZE = 46;
  const BUTTON_SAFETY = 12;

  let settings = { ...DEFAULTS };
  let overlay = null;
  let button = null;
  let sensor = null;
  let visualizer = null;
  let visualizerTimer = null;
  let yieldTimer = null;
  let mouseX = 0;
  let mouseY = 9999;
  let mouseInActiveZone = false;
  let buttonVisible = false;
  let hideTimer = null;
  let leaveTimer = null;

  function getMinimumTriggerHeight() {
    return Number(settings.buttonOffset) + BUTTON_SIZE + BUTTON_SAFETY;
  }

  function getTriggerHeightPct() {
    const rawVal = Number(settings.triggerHeight);
    return rawVal > 30 ? 8 : Math.max(4, Math.min(30, rawVal || 8));
  }

  function getTriggerHeight() {
    const screenHeight = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 1080;
    const calculatedPx = Math.round((screenHeight * getTriggerHeightPct()) / 100);
    return Math.max(calculatedPx, getMinimumTriggerHeight());
  }

  function getTriggerWidth() {
    return Math.max(20, Math.min(100, Number(settings.triggerWidth) || 100));
  }

  function getTriggerHorizontalBounds() {
    const widthPct = getTriggerWidth();
    const halfWidthPct = widthPct / 2;
    const screenWidth = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1920;
    const centerX = screenWidth / 2;
    const halfWidthPx = (screenWidth * halfWidthPct) / 100;
    return {
      left: centerX - halfWidthPx,
      right: centerX + halfWidthPx
    };
  }

  function isMouseInTriggerZone() {
    const triggerHeight = getTriggerHeight();
    if (mouseY > triggerHeight) return false;
    const bounds = getTriggerHorizontalBounds();
    return mouseX >= bounds.left && mouseX <= bounds.right;
  }

  function hasIframeTarget() {
    const fs = document.fullscreenElement;
    if (!fs) return false;
    if (fs instanceof HTMLIFrameElement || fs.tagName === "IFRAME") return true;
    try {
      if (fs.querySelector && fs.querySelector("iframe")) return true;
    } catch {}
    return false;
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
    let shouldPreview = false;
    for (const key of Object.keys(changes)) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        settings[key] = changes[key].newValue;
      }
      if (key === "previewTimestamp" || key === "triggerWidth" || key === "triggerHeight") {
        shouldPreview = true;
      }
    }
    updateButtonPosition();
    updateButtonStyle();
    if (shouldPreview) {
      showVisualizer();
    }
    if (!settings.enabled) {
      hideButton();
      return;
    }
    if (isFullscreenActive()) {
      updateMouseZone();
    }
  });

  browser.runtime.onMessage.addListener(message => {
    if (message && message.action === "preview_trigger_zone") {
      if (typeof message.triggerHeight === "number") {
        settings.triggerHeight = message.triggerHeight;
      }
      if (typeof message.triggerWidth === "number") {
        settings.triggerWidth = message.triggerWidth;
      }
      updateButtonPosition();
      showVisualizer();
    }
  });

  function passEventThrough(event) {
    if (!sensor) return;
    sensor.classList.add("disabled");
    const x = event.clientX;
    const y = event.clientY;
    const elementBelow = document.elementFromPoint(x, y);
    if (elementBelow && elementBelow !== sensor) {
      try {
        elementBelow.dispatchEvent(new PointerEvent(event.type, event));
      } catch {
        try {
          elementBelow.dispatchEvent(new MouseEvent(event.type, event));
        } catch {}
      }
    }
    if (yieldTimer) clearTimeout(yieldTimer);
    yieldTimer = setTimeout(() => {
      if (sensor) sensor.classList.remove("disabled");
    }, 350);
  }

  function showVisualizer() {
    if (window.self !== window.top) return;
    if (!settings.enabled) return;
    if (!visualizer || !visualizer.parentElement) {
      if (!visualizer) {
        visualizer = document.createElement("div");
        visualizer.id = "firefox-fullscreen-exit-visualizer";
      }
      const target = document.fullscreenElement || document.body || document.documentElement;
      try {
        target.appendChild(visualizer);
      } catch {
        try {
          (document.body || document.documentElement).appendChild(visualizer);
        } catch {}
      }
    }
    updateButtonPosition();
    visualizer.classList.remove("visible");
    void visualizer.offsetWidth;
    visualizer.classList.add("visible");

    if (visualizerTimer) clearTimeout(visualizerTimer);
    visualizerTimer = setTimeout(() => {
      if (visualizer) {
        visualizer.classList.remove("visible");
      }
    }, 1800);
  }

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

    sensor.addEventListener("pointerdown", event => {
      if (event.target === button || (button && button.contains(event.target))) return;
      passEventThrough(event);
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
    if (button) {
      button.style.setProperty("--button-offset", `${Number(settings.buttonOffset)}px`);
    }
    const height = `${getTriggerHeight()}px`;
    const width = `${getTriggerWidth()}vw`;
    if (sensor) {
      sensor.style.setProperty("--sensor-height", height);
      sensor.style.setProperty("--sensor-width", width);
      sensor.style.setProperty("height", height, "important");
      sensor.style.setProperty("width", width, "important");
    }
    if (visualizer) {
      visualizer.style.setProperty("--visualizer-height", height);
      visualizer.style.setProperty("--visualizer-width", width);
      visualizer.style.setProperty("height", height, "important");
      visualizer.style.setProperty("width", width, "important");
      visualizer.textContent = `Active Zone (${getTriggerWidth()}% × ${getTriggerHeightPct()}%)`;
    }
  }

  function updateButtonStyle() {
    if (!button) return;
    button.setAttribute("data-style", settings.buttonStyle || "glass");
  }

  function removeButton() {
    if (overlay) overlay.remove();
    if (sensor) sensor.remove();
    if (visualizer) visualizer.remove();
    overlay = null;
    button = null;
    sensor = null;
    visualizer = null;
    buttonVisible = false;
    mouseInActiveZone = false;
    cancelTimers();
  }

  function cancelTimers() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    if (yieldTimer) { clearTimeout(yieldTimer); yieldTimer = null; }
    if (visualizerTimer) { clearTimeout(visualizerTimer); visualizerTimer = null; }
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

    const inTriggerArea = isMouseInTriggerZone();
    const overButton = button && button.matches(":hover");
    const active = inTriggerArea || overButton;
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

    // Only attach the top sensor if an iframe is detected in fullscreen!
    // Native players (like YouTube, HTML5 video) do not need the sensor because
    // the document's global mousemove listener works 100% natively without blocking controls.
    if (hasIframeTarget()) {
      if (sensor && !target.contains(sensor)) {
        try {
          target.appendChild(sensor);
        } catch {
          try {
            (document.body || document.documentElement).appendChild(sensor);
          } catch {}
        }
      }
    } else {
      // If native player, ensure sensor is detached
      if (sensor && sensor.parentElement) {
        sensor.remove();
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