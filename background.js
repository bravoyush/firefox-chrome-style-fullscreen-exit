(() => {
  "use strict";

  let lastWindowState = "maximized";

  function trackWindowState(win) {
    if (win && win.state && win.state !== "fullscreen") {
      lastWindowState = win.state;
    }
  }

  // Record initial window state
  browser.windows.getCurrent().then(trackWindowState).catch(() => {});

  // Update last non-fullscreen state on window focus or bounds changes
  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== browser.windows.WINDOW_ID_NONE) {
      browser.windows.get(windowId).then(trackWindowState).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message && message.action === "exit_window_fullscreen") {
      browser.windows.getCurrent().then(win => {
        if (win && typeof win.id === "number") {
          // Restore to previous state (maximized or normal) instead of forcing normal
          const restoreState = lastWindowState === "normal" ? "normal" : "maximized";
          browser.windows.update(win.id, { state: restoreState }).catch(() => {});
        }
      }).catch(() => {});
    }
  });
})();
