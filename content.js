(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    buttonOffset: 14,
    triggerHeight: 70,
    timeout: 2500
  };

  const BUTTON_SIZE = 46;
  const BUTTON_SAFETY = 12;

  let settings = { ...DEFAULTS };
  let overlay = null;
  let button = null;
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

  async function loadSettings() {
    try {
      const stored = await browser.storage.local.get(DEFAULTS);
      settings = { ...DEFAULTS, ...stored };
      updateButtonPosition();
      // Check if page/video is ALREADY in fullscreen when script loads/reloads
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
    if (!settings.enabled) {
      hideButton();
      return;
    }
    if (document.fullscreenElement) {
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
    button.textContent = "×";
    button.setAttribute("aria-label", "Exit fullscreen");
    button.title = "Exit fullscreen";

    overlay.appendChild(button);

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });

    button.addEventListener("mouseenter", () => {
      if (!document.fullscreenElement || !settings.enabled) return;
      mouseInActiveZone = true;
      cancelTimers();
    });

    button.addEventListener("mouseleave", () => {
      if (!document.fullscreenElement) return;
      updateMouseZone();
    });

    updateButtonPosition();
  }

  function updateButtonPosition() {
    if (!button) return;
    button.style.setProperty("--button-offset", `${Number(settings.buttonOffset)}px`);
  }

  function removeButton() {
    if (overlay) overlay.remove();
    overlay = null;
    button = null;
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
    if (!document.fullscreenElement || !overlay || !settings.enabled) {
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
    if (!document.fullscreenElement || !overlay || !settings.enabled) return;
    mouseX = event.clientX;
    mouseY = event.clientY;
    updateMouseZone();
  }, true);

  function fullscreenChanged() {
    const fullscreenElement = document.fullscreenElement;

    if (!fullscreenElement) {
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

    if (!fullscreenElement.contains(overlay)) {
      try {
        fullscreenElement.appendChild(overlay);
      } catch {}
    }

    overlay.classList.remove("show");
    overlay.classList.remove("hiding");
    buttonVisible = false;

    updateMouseZone();
  }

  document.addEventListener("fullscreenchange", fullscreenChanged);

  const observer = new MutationObserver(() => {
    const fullscreenElement = document.fullscreenElement;
    if (!fullscreenElement || !overlay || !settings.enabled) return;

    if (!fullscreenElement.contains(overlay)) {
      try {
        fullscreenElement.appendChild(overlay);
      } catch {}
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  loadSettings();
})();