(() => {

  "use strict";


  /*
   * ==========================================
   * CONSTANTS
   * ==========================================
   */

  const WRAPPER_ATTRIBUTE =
    "data-chromium-fs-wrapper";


  const ORIGINAL_STYLES =
    "data-chromium-fs-old-styles";


  /*
   * Keep a reference to Firefox's original
   * fullscreen function.
   */

  const originalRequestFullscreen =
    Element.prototype.requestFullscreen;


  /*
   * Prevent installing the hook twice.
   */

  if (
    Element.prototype
      .__chromiumFullscreenExitInstalled
  ) {

    return;

  }


  Object.defineProperty(
    Element.prototype,
    "__chromiumFullscreenExitInstalled",
    {
      value: true,
      configurable: false
    }
  );


  /*
   * ==========================================
   * FULLSCREEN REQUEST INTERCEPTOR
   * ==========================================
   */

  Element.prototype.requestFullscreen =
    function(options) {

      const element = this;


      /*
       * Don't interfere with our own wrapper.
       */

      if (
        element.hasAttribute(
          WRAPPER_ATTRIBUTE
        )
      ) {

        return originalRequestFullscreen.call(
          element,
          options
        );

      }


      /*
       * ========================================
       * VIDEO
       * ========================================
       *
       * A <video> is a replaced element and
       * cannot reliably display children.
       *
       * Therefore we put it inside a wrapper
       * before making it fullscreen.
       */

      if (
        element instanceof HTMLVideoElement
      ) {

        return requestVideoFullscreen(
          element,
          options
        );

      }


      /*
       * ========================================
       * OTHER PLAYER ELEMENTS
       * ========================================
       *
       * Divs, sections, custom player elements,
       * etc. can directly become fullscreen.
       *
       * We DON'T wrap these.
       *
       * content.js can place the floating button
       * directly inside the fullscreen element.
       */

      return originalRequestFullscreen.call(
        element,
        options
      );

    };


  /*
   * ==========================================
   * VIDEO FULLSCREEN
   * ==========================================
   */

  function requestVideoFullscreen(
    video,
    options
  ) {

    /*
     * Already wrapped.
     */

    if (
      video.parentElement?.hasAttribute(
        WRAPPER_ATTRIBUTE
      )
    ) {

      return originalRequestFullscreen.call(
        video.parentElement,
        options
      );

    }


    const parent =
      video.parentNode;


    /*
     * If the video isn't currently attached
     * to the document, don't interfere.
     */

    if (!parent) {

      return originalRequestFullscreen.call(
        video,
        options
      );

    }


    /*
     * ========================================
     * CREATE WRAPPER
     * ========================================
     */

    const wrapper =
      document.createElement("div");


    wrapper.setAttribute(
      WRAPPER_ATTRIBUTE,
      "true"
    );


    /*
     * ========================================
     * SAVE ORIGINAL STYLES
     * ========================================
     */

    const oldStyles = {

      width:
        video.style.width,

      height:
        video.style.height,

      maxWidth:
        video.style.maxWidth,

      maxHeight:
        video.style.maxHeight,

      objectFit:
        video.style.objectFit,

      position:
        video.style.position,

      display:
        video.style.display

    };


    video.setAttribute(
      ORIGINAL_STYLES,
      JSON.stringify(oldStyles)
    );


    /*
     * ========================================
     * WRAPPER STYLE
     * ========================================
     */

    wrapper.style.position =
      "relative";

    wrapper.style.width =
      "100%";

    wrapper.style.height =
      "100%";

    wrapper.style.background =
      "black";

    wrapper.style.overflow =
      "hidden";


    /*
     * ========================================
     * MOVE VIDEO
     * ========================================
     */

    parent.insertBefore(
      wrapper,
      video
    );

    wrapper.appendChild(
      video
    );


    /*
     * ========================================
     * VIDEO STYLE
     * ========================================
     */

    video.style.width =
      "100%";

    video.style.height =
      "100%";

    video.style.maxWidth =
      "100%";

    video.style.maxHeight =
      "100%";

    video.style.objectFit =
      "contain";


    /*
     * ========================================
     * REQUEST FULLSCREEN
     * ========================================
     */

    let promise;


    try {

      promise =
        originalRequestFullscreen.call(
          wrapper,
          options
        );

    } catch (error) {

      restoreVideoWrapper(
        wrapper
      );

      throw error;

    }


    /*
     * If fullscreen is rejected, immediately
     * restore the original DOM.
     */

    if (
      promise &&
      typeof promise.catch ===
        "function"
    ) {

      promise.catch(
        () => {

          restoreVideoWrapper(
            wrapper
          );

        }
      );

    }


    return promise;

  }


  /*
   * ==========================================
   * FULLSCREEN CHANGE
   * ==========================================
   */

  document.addEventListener(
    "fullscreenchange",
    () => {

      /*
       * If our wrapper is currently fullscreen,
       * leave it alone.
       */

      const fullscreenElement =
        document.fullscreenElement;


      document
        .querySelectorAll(
          `[${WRAPPER_ATTRIBUTE}]`
        )
        .forEach(
          wrapper => {

            if (
              fullscreenElement === wrapper
            ) {

              return;

            }


            /*
             * Fullscreen ended.
             */

            restoreVideoWrapper(
              wrapper
            );

          }
        );

    },
    true
  );


  /*
   * ==========================================
   * RESTORE VIDEO
   * ==========================================
   */

  function restoreVideoWrapper(
    wrapper
  ) {

    if (!wrapper) {
      return;
    }


    const video =
      wrapper.querySelector(
        "video"
      );


    if (!video) {

      wrapper.remove();

      return;

    }


    /*
     * Restore original styles.
     */

    const saved =
      video.getAttribute(
        ORIGINAL_STYLES
      );


    if (saved) {

      try {

        const oldStyles =
          JSON.parse(saved);


        video.style.width =
          oldStyles.width;

        video.style.height =
          oldStyles.height;

        video.style.maxWidth =
          oldStyles.maxWidth;

        video.style.maxHeight =
          oldStyles.maxHeight;

        video.style.objectFit =
          oldStyles.objectFit;

        video.style.position =
          oldStyles.position;

        video.style.display =
          oldStyles.display;

      } catch (error) {

        console.warn(
          "Fullscreen Exit: Could not restore video styles.",
          error
        );

      }

    }


    video.removeAttribute(
      ORIGINAL_STYLES
    );


    /*
     * Put video back where the wrapper was.
     */

    if (wrapper.parentNode) {

      wrapper.parentNode.insertBefore(
        video,
        wrapper
      );

    }


    wrapper.remove();

  }


})();