(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    buttonStyle: "solid",
    popupTheme: "neutral",
    buttonOffset: 60,
    triggerHeight: 8,
    triggerWidth: 100,
    timeout: 3500
  };

  const BUTTON_SIZE = 46;
  const BUTTON_SAFETY = 12;

  const enabled = document.getElementById("enabled");
  const offset = document.getElementById("offset");
  const trigger = document.getElementById("trigger");
  const triggerWidth = document.getElementById("triggerWidth");
  const timeout = document.getElementById("timeout");
  const offsetValue = document.getElementById("offsetValue");
  const triggerValue = document.getElementById("triggerValue");
  const triggerWidthValue = document.getElementById("triggerWidthValue");
  const triggerDescription = document.getElementById("triggerDescription");
  const timeoutValue = document.getElementById("timeoutValue");
  const styleLabel = document.getElementById("styleLabel");
  const styleCards = document.querySelectorAll('.style-card[data-style]');
  const themeLabel = document.getElementById("themeLabel");
  const themeCards = document.querySelectorAll('.style-card[data-theme]');

  let currentStyle = "solid";
  let currentTheme = "neutral";
  
  const openGuideModal = document.getElementById("openGuideModal");
  const closeGuideModal = document.getElementById("closeGuideModal");
  const guideModal = document.getElementById("guideModal");
  const toggleAppearance = document.getElementById("toggleAppearance");
  const appearanceBody = document.getElementById("appearanceBody");
  const appearanceSummary = document.getElementById("appearanceSummary");

  if (!enabled || !offset || !trigger || !timeout) return;

  // Modal Handlers
  if (openGuideModal && closeGuideModal && guideModal) {
    openGuideModal.addEventListener("click", () => {
      guideModal.classList.remove("hidden");
    });
    closeGuideModal.addEventListener("click", () => {
      guideModal.classList.add("hidden");
    });
    guideModal.addEventListener("click", (event) => {
      if (event.target === guideModal) {
        guideModal.classList.add("hidden");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !guideModal.classList.contains("hidden")) {
        guideModal.classList.add("hidden");
      }
    });
  }

  // Click-to-copy for guide code snippets
  const copyToast = document.getElementById("copyToast");
  let toastTimer = null;

  function showToast(message) {
    if (!copyToast) return;
    copyToast.textContent = message || "Copied to clipboard!";
    copyToast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      copyToast.classList.remove("visible");
    }, 1600);
  }

  document.querySelectorAll(".guide-steps code").forEach(codeEl => {
    codeEl.addEventListener("click", async () => {
      const textToCopy = codeEl.textContent.trim();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const tempInput = document.createElement("input");
          tempInput.value = textToCopy;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand("copy");
          document.body.removeChild(tempInput);
        }
        showToast(`Copied "${textToCopy}"`);
      } catch (err) {
        showToast("Copied to clipboard!");
      }
    });
  });

  function updateAppearanceSummary() {
    if (appearanceSummary) {
      const styleName = currentStyle === "solid" ? "Solid" : "Glass";
      const themeName = currentTheme === "neutral" ? "Neutral" : "macOS";
      appearanceSummary.textContent = `${styleName} · ${themeName}`;
    }
  }

  function setAppearanceOpen(isOpen, shouldSave = true) {
    if (!appearanceBody || !toggleAppearance) return;
    appearanceBody.classList.toggle("hidden", !isOpen);
    toggleAppearance.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (shouldSave) {
      browser.storage.local.set({ appearanceOpen: isOpen }).catch(() => {});
    }
  }

  if (toggleAppearance && appearanceBody) {
    toggleAppearance.addEventListener("click", () => {
      const isCurrentlyOpen = !appearanceBody.classList.contains("hidden");
      setAppearanceOpen(!isCurrentlyOpen, true);
    });
  }

  function setStyle(style, shouldSave = true) {
    currentStyle = style === "solid" ? "solid" : "glass";
    styleCards.forEach(card => {
      const isSelected = card.getAttribute("data-style") === currentStyle;
      card.classList.toggle("active", isSelected);
      card.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
    if (styleLabel) {
      styleLabel.textContent = currentStyle === "solid" ? "Solid" : "Glass";
    }
    updateAppearanceSummary();
    if (shouldSave) {
      save();
    }
  }

  function setTheme(theme, shouldSave = true) {
    currentTheme = theme === "neutral" ? "neutral" : "macos";
    document.documentElement.setAttribute("data-popup-theme", currentTheme);
    themeCards.forEach(card => {
      const isSelected = card.getAttribute("data-theme") === currentTheme;
      card.classList.toggle("active", isSelected);
      card.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
    if (themeLabel) {
      themeLabel.textContent = currentTheme === "neutral" ? "Neutral" : "macOS";
    }
    updateAppearanceSummary();
    if (shouldSave) {
      save();
    }
  }

  styleCards.forEach(card => {
    card.addEventListener("click", () => {
      const style = card.getAttribute("data-style");
      setStyle(style, true);
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const style = card.getAttribute("data-style");
        setStyle(style, true);
      }
    });
  });

  themeCards.forEach(card => {
    card.addEventListener("click", () => {
      const theme = card.getAttribute("data-theme");
      setTheme(theme, true);
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const theme = card.getAttribute("data-theme");
        setTheme(theme, true);
      }
    });
  });

  function updateLabels() {
    offsetValue.textContent = `${offset.value} px`;
    triggerValue.textContent = `${trigger.value}%`;
    if (triggerWidthValue && triggerWidth) {
      triggerWidthValue.textContent = `${triggerWidth.value}%`;
    }
    const seconds = Number(timeout.value) / 1000;
    timeoutValue.textContent = `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)} s`;
  }

  async function save(triggerPreview = false) {
    try {
      const payload = {
        enabled: enabled.checked,
        buttonStyle: currentStyle,
        popupTheme: currentTheme,
        buttonOffset: Number(offset.value),
        triggerHeight: Number(trigger.value),
        triggerWidth: triggerWidth ? Number(triggerWidth.value) : 100,
        timeout: Number(timeout.value)
      };
      if (triggerPreview) {
        payload.previewTimestamp = Date.now();
      }
      await browser.storage.local.set(payload);
    } catch (error) {
      console.error("Fullscreen Exit: Failed to save settings.", error);
    }
  }

  async function load() {
    try {
      const settings = await browser.storage.local.get(DEFAULTS);
      enabled.checked = settings.enabled;
      setStyle(settings.buttonStyle || "glass", false);
      setTheme(settings.popupTheme || "macos", false);
      offset.value = settings.buttonOffset;
      timeout.value = settings.timeout;

      // Migrate older raw pixel heights (e.g. 72, 118) to clean percentage (default 8%)
      if (Number(settings.triggerHeight) > 30) {
        trigger.value = 8;
        browser.storage.local.set({ triggerHeight: 8 }).catch(() => {});
      } else if (settings.triggerHeight !== undefined) {
        trigger.value = settings.triggerHeight;
      }

      if (triggerWidth && settings.triggerWidth !== undefined) {
        triggerWidth.value = settings.triggerWidth;
      }

      updateLabels();
      paintAllSliders();
      updateAppearanceSummary();
      setAppearanceOpen(Boolean(settings.appearanceOpen), false);
    } catch (error) {
      console.error("Fullscreen Exit: Failed to load settings.", error);
    }
  }

  function notifyActiveTabPreview() {
    try {
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs && tabs[0] && typeof tabs[0].id === "number") {
          browser.tabs.sendMessage(tabs[0].id, {
            action: "preview_trigger_zone",
            triggerHeight: Number(trigger.value),
            triggerWidth: triggerWidth ? Number(triggerWidth.value) : 100
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  }

  enabled.addEventListener("change", () => save(false));
  offset.addEventListener("input", () => { updateLabels(); paintAllSliders(); save(false); });
  trigger.addEventListener("input", () => { updateLabels(); paintAllSliders(); notifyActiveTabPreview(); save(true); });
  if (triggerWidth) {
    triggerWidth.addEventListener("input", () => { updateLabels(); paintAllSliders(); notifyActiveTabPreview(); save(true); });
  }
  timeout.addEventListener("input", () => { updateLabels(); paintAllSliders(); save(false); });

  const resetDefaults = document.getElementById("resetDefaults");
  if (resetDefaults) {
    resetDefaults.addEventListener("click", async () => {
      enabled.checked = DEFAULTS.enabled;
      offset.value = DEFAULTS.buttonOffset;
      trigger.value = DEFAULTS.triggerHeight;
      if (triggerWidth) triggerWidth.value = DEFAULTS.triggerWidth;
      timeout.value = DEFAULTS.timeout;
      setStyle(DEFAULTS.buttonStyle, false);
      setTheme(DEFAULTS.popupTheme, false);
      updateLabels();
      paintAllSliders();
      notifyActiveTabPreview();
      await save(true);
      showToast("Reset to defaults!");
    });
  }

  function paintSlider(el) {
    if (!el) return;
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const value = Number(el.value);
    const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
    el.style.setProperty("--fill-pct", `${percentage}%`);
  }

  function paintAllSliders() {
    document.querySelectorAll('input[type="range"]').forEach(paintSlider);
  }

  // Bind slider painting listeners safely in external script
  document.querySelectorAll('input[type="range"]').forEach(el => {
    el.addEventListener("input", () => paintSlider(el));
    new MutationObserver(() => paintSlider(el))
      .observe(el, { attributes: true, attributeFilter: ["value"] });
  });

  load();
})();