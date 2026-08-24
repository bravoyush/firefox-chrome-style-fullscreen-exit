(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    buttonStyle: "glass",
    buttonOffset: 14,
    triggerHeight: 72,
    timeout: 2500
  };

  const BUTTON_SIZE = 46;
  const BUTTON_SAFETY = 12;

  const enabled = document.getElementById("enabled");
  const offset = document.getElementById("offset");
  const trigger = document.getElementById("trigger");
  const timeout = document.getElementById("timeout");
  const offsetValue = document.getElementById("offsetValue");
  const triggerValue = document.getElementById("triggerValue");
  const triggerDescription = document.getElementById("triggerDescription");
  const timeoutValue = document.getElementById("timeoutValue");
  const styleLabel = document.getElementById("styleLabel");
  const styleCards = document.querySelectorAll(".style-card");

  let currentStyle = "glass";
  
  const openGuideModal = document.getElementById("openGuideModal");
  const closeGuideModal = document.getElementById("closeGuideModal");
  const guideModal = document.getElementById("guideModal");

  if (!enabled || !offset || !trigger || !timeout) return;

  // Modal Handlers
  if (openGuideModal && closeGuideModal && guideModal) {
    openGuideModal.addEventListener("click", () => {
      guideModal.classList.remove("hidden");
    });
    closeGuideModal.addEventListener("click", () => {
      guideModal.classList.add("hidden");
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

  function getMinimumTriggerHeight(buttonOffset) {
    return Number(buttonOffset) + BUTTON_SIZE + BUTTON_SAFETY;
  }

  function updateTriggerMinimum() {
    const minimum = getMinimumTriggerHeight(Number(offset.value));
    trigger.min = minimum;
    if (Number(trigger.value) < minimum) {
      trigger.value = minimum;
    }
    if (triggerDescription) {
      triggerDescription.textContent = `Active zone to keep floating button visible`;
    }
  }

  function updateLabels() {
    offsetValue.textContent = `${offset.value} px`;
    triggerValue.textContent = `${trigger.value} px`;
    const seconds = Number(timeout.value) / 1000;
    timeoutValue.textContent = `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)} s`;
  }

  async function save() {
    try {
      await browser.storage.local.set({
        enabled: enabled.checked,
        buttonStyle: currentStyle,
        buttonOffset: Number(offset.value),
        triggerHeight: Number(trigger.value),
        timeout: Number(timeout.value)
      });
    } catch (error) {
      console.error("Fullscreen Exit: Failed to save settings.", error);
    }
  }

  async function load() {
    try {
      const settings = await browser.storage.local.get(DEFAULTS);
      enabled.checked = settings.enabled;
      setStyle(settings.buttonStyle || "glass", false);
      offset.value = settings.buttonOffset;
      timeout.value = settings.timeout;

      updateTriggerMinimum();
      if (Number(settings.triggerHeight) >= Number(trigger.min)) {
        trigger.value = settings.triggerHeight;
      }

      updateLabels();
      paintAllSliders();
    } catch (error) {
      console.error("Fullscreen Exit: Failed to load settings.", error);
    }
  }

  enabled.addEventListener("change", save);
  offset.addEventListener("input", () => { updateTriggerMinimum(); updateLabels(); paintAllSliders(); save(); });
  trigger.addEventListener("input", () => { updateLabels(); paintAllSliders(); save(); });
  timeout.addEventListener("input", () => { updateLabels(); paintAllSliders(); save(); });

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