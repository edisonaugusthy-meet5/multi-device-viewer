import { defineContentScript } from "wxt/utils/define-content-script";

const OVERLAY_ID = "multi-device-viewer-overlay";

export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  allFrames: true,
  runAt: "document_idle",
  main() {
    setupPreviewBridge();

    if (window.top === window) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message !== null && typeof message === "object") {
          if (message.type === "OPEN_SIMULATOR") {
            toggleSimulator(typeof message.url === "string" ? message.url : undefined);
          } else if (message.type === "HIDE_OVERLAY") {
            const el = document.getElementById(OVERLAY_ID);
            if (el) el.style.visibility = "hidden";
          } else if (message.type === "SHOW_OVERLAY") {
            const el = document.getElementById(OVERLAY_ID);
            if (el) el.style.visibility = "visible";
          }
        }
      });
    }
  },
});

function setupPreviewBridge() {
  let slotId: string | undefined;
  let programmaticScroll = false;
  let resetTimer: number | undefined;
  let inspectEnabled = false;
  let inspectRafPending = false;
  let inspectPendingX = -1;
  let inspectPendingY = -1;
  // Track the last element we inspected so we only run getComputedStyle when it changes
  let lastInspectedEl: Element | null = null;

  const root = () => document.scrollingElement ?? document.documentElement;
  const scrollRatios = () => {
    const el = root();
    const maxX = Math.max(1, el.scrollWidth - window.innerWidth);
    const maxY = Math.max(1, el.scrollHeight - window.innerHeight);
    return {
      xRatio: el.scrollLeft / maxX,
      yRatio: el.scrollTop / maxY,
      scrollHeight: el.scrollHeight,
      scrollWidth: el.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  };

  const announceReady = () => {
    if (!slotId) return;
    window.parent.postMessage({
      type: "MDV_PREVIEW_READY",
      slotId,
      url: window.location.href,
      ...scrollRatios()
    }, "*");
  };

  function rgbToHex(rgb: string): string {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return rgb;
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function buildBreadcrumb(el: Element): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let label = cur.tagName.toLowerCase();
      if (cur.id) label += `#${cur.id}`;
      else if (cur.classList.length) label += `.${Array.from(cur.classList).slice(0, 2).join(".")}`;
      parts.unshift(label);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function collectInspectData(el: Element, x: number, y: number) {
    const rect = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const classes = Array.from(el.classList);

    // Flex/Grid context props
    const isFlexItem = cs.display === "flex" || cs.display === "inline-flex";
    const isGridItem = cs.display === "grid" || cs.display === "inline-grid";
    const parentCs = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
    const parentDisplay = parentCs?.display ?? "";
    const isInFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
    const isInGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";

    // Build a compact "copy as CSS" snippet
    const cssSnippet = [
      `display: ${cs.display};`,
      cs.position !== "static" ? `position: ${cs.position};` : "",
      `width: ${Math.round(rect.width)}px;`,
      `height: ${Math.round(rect.height)}px;`,
      cs.paddingTop !== "0px" || cs.paddingRight !== "0px" || cs.paddingBottom !== "0px" || cs.paddingLeft !== "0px"
        ? `padding: ${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft};` : "",
      cs.marginTop !== "0px" || cs.marginRight !== "0px" || cs.marginBottom !== "0px" || cs.marginLeft !== "0px"
        ? `margin: ${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft};` : "",
      cs.fontSize ? `font-size: ${cs.fontSize};` : "",
      cs.fontWeight ? `font-weight: ${cs.fontWeight};` : "",
      cs.color ? `color: ${rgbToHex(cs.color)};` : "",
      cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? `background-color: ${rgbToHex(cs.backgroundColor)};` : "",
      cs.borderRadius && cs.borderRadius !== "0px" ? `border-radius: ${cs.borderRadius};` : "",
      cs.boxShadow && cs.boxShadow !== "none" ? `box-shadow: ${cs.boxShadow};` : "",
    ].filter(Boolean).join("\n");

    const post = (type: string) => {
      if (!slotId) return;
      window.parent.postMessage({
        type,
        slotId,
        tagName: el.tagName,
        id: el.id,
        classes,
        breadcrumb: buildBreadcrumb(el),
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        color: cs.color,
        colorHex: rgbToHex(cs.color),
        backgroundColor: cs.backgroundColor,
        backgroundColorHex: rgbToHex(cs.backgroundColor),
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        marginTop: cs.marginTop,
        marginRight: cs.marginRight,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        borderWidth: cs.borderWidth,
        borderColor: cs.borderColor,
        borderColorHex: rgbToHex(cs.borderColor),
        width: rect.width,
        height: rect.height,
        display: cs.display,
        position: cs.position,
        overflow: cs.overflow,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        transform: cs.transform !== "none" ? cs.transform : "",
        borderRadius: cs.borderRadius,
        opacity: cs.opacity,
        zIndex: cs.zIndex,
        boxShadow: cs.boxShadow,
        // Flex/Grid
        isFlexContainer: isFlexItem,
        flexDirection: isFlexItem ? cs.flexDirection : "",
        flexWrap: isFlexItem ? cs.flexWrap : "",
        justifyContent: isFlexItem ? cs.justifyContent : "",
        alignItems: isFlexItem ? cs.alignItems : "",
        gap: isFlexItem || isGridItem ? cs.gap : "",
        isGridContainer: isGridItem,
        gridTemplateColumns: isGridItem ? cs.gridTemplateColumns : "",
        gridTemplateRows: isGridItem ? cs.gridTemplateRows : "",
        isInFlex,
        flexGrow: isInFlex ? cs.flexGrow : "",
        flexShrink: isInFlex ? cs.flexShrink : "",
        flexBasis: isInFlex ? cs.flexBasis : "",
        alignSelf: isInFlex || isInGrid ? cs.alignSelf : "",
        isInGrid,
        gridColumn: isInGrid ? cs.gridColumn : "",
        gridRow: isInGrid ? cs.gridRow : "",
        cssSnippet,
        x,
        y,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      }, "*");
    };
    return post;
  }

  function fireInspectMove() {
    inspectRafPending = false;
    if (!inspectEnabled || !slotId) return;
    const x = inspectPendingX;
    const y = inspectPendingY;
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    const rect = el.getBoundingClientRect();

    // Always post the lightweight rect message — drives the highlight box via direct DOM, no React re-render
    window.parent.postMessage({
      type: "MDV_INSPECT_MOVE",
      slotId,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    }, "*");

    // Only run getComputedStyle (expensive) when the element has changed
    if (el !== lastInspectedEl) {
      lastInspectedEl = el;
      const post = collectInspectData(el, x, y);
      post("MDV_INSPECT_DATA");
    }
  }

  window.addEventListener("mousemove", (e) => {
    if (!inspectEnabled) return;
    // Always store the latest coords so RAF fires with the freshest position
    inspectPendingX = e.clientX;
    inspectPendingY = e.clientY;
    if (!inspectRafPending) {
      inspectRafPending = true;
      requestAnimationFrame(fireInspectMove);
    }
  }, { passive: true });

  window.addEventListener("click", (e) => {
    if (!inspectEnabled) return;
    const x = e.clientX;
    const y = e.clientY;
    const el = document.elementFromPoint(x, y);
    if (!el || !slotId) return;
    const post = collectInspectData(el, x, y);
    post("MDV_INSPECT_CLICK");
  }, { passive: true });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "MDV_PREVIEW_REGISTER" && typeof data.slotId === "string") {
      slotId = data.slotId;
      announceReady();
      return;
    }

    if (data.type === "MDV_APPLY_SCROLL_SYNC" && typeof data.slotId === "string" && data.slotId === slotId) {
      const el = root();
      const maxX = Math.max(0, el.scrollWidth - window.innerWidth);
      const maxY = Math.max(0, el.scrollHeight - window.innerHeight);
      programmaticScroll = true;
      window.scrollTo({
        left: maxX * Number(data.xRatio ?? 0),
        top: maxY * Number(data.yRatio ?? 0),
        behavior: "auto"
      });
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        programmaticScroll = false;
      }, 120);
    }

    if (data.type === "MDV_INSPECT_ENABLE" && typeof data.slotId === "string") {
      slotId = data.slotId;
      inspectEnabled = true;
      inspectPendingX = -1;
      inspectPendingY = -1;
      lastInspectedEl = null;
    }

    if (data.type === "MDV_INSPECT_DISABLE" && typeof data.slotId === "string") {
      inspectEnabled = false;
      inspectRafPending = false;
      lastInspectedEl = null;
    }
  });

  window.addEventListener("scroll", () => {
    if (!slotId || programmaticScroll) return;
    window.parent.postMessage({
      type: "MDV_SCROLL_SYNC_EVENT",
      slotId,
      ...scrollRatios()
    }, "*");
  }, { passive: true });

  window.addEventListener("error", () => {
    if (!slotId) return;
    window.parent.postMessage({
      type: "MDV_PREVIEW_BLOCKED_OR_UNAVAILABLE",
      slotId,
      url: window.location.href
    }, "*");
  });
}

function toggleSimulator(targetUrl?: string) {
  // If overlay is already open, close it (toggle behaviour).
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
    document.documentElement.style.removeProperty("overflow");
    return;
  }

  // Build the simulator page URL with the current page URL pre-loaded.
  const simulatorBase = chrome.runtime.getURL("/simulator.html");
  const simulatorUrl = new URL(simulatorBase);
  const pageUrl = targetUrl ?? window.location.href;
  if (/^https?:\/\//i.test(pageUrl)) {
    simulatorUrl.searchParams.set("url", pageUrl);
  }

  // Outer container — full-screen fixed overlay.
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    flexDirection: "row",
    background: "transparent",
  });

  // The iframe fills the entire overlay — close button lives inside the React app sidebar.
  const iframe = document.createElement("iframe");
  iframe.src = simulatorUrl.toString();
  iframe.allow = "downloads; clipboard-write";
  Object.assign(iframe.style, {
    flex: "1",
    height: "100%",
    border: "none",
    display: "block",
    background: "#f5f5f3",
  });

  // Listen for postMessages posted from inside the iframe.
  const onMessage = async (e: MessageEvent) => {
    if (e.data?.type === "CLOSE_SIMULATOR") {
      overlay.remove();
      document.documentElement.style.removeProperty("overflow");
      window.removeEventListener("message", onMessage);
      return;
    }

    // COPY_IMAGE: the iframe cannot access clipboard directly (permissions policy).
    // The content script runs in the page context and CAN write to the clipboard.
    if (e.data?.type === "COPY_IMAGE" && typeof e.data.dataUrl === "string") {
      try {
        const res = await fetch(e.data.dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        iframe.contentWindow?.postMessage({ type: "COPY_IMAGE_RESULT", ok: true }, "*");
      } catch (err) {
        iframe.contentWindow?.postMessage({ type: "COPY_IMAGE_RESULT", ok: false, error: String(err) }, "*");
      }
    }
  };
  window.addEventListener("message", onMessage);

  overlay.appendChild(iframe);
  document.documentElement.appendChild(overlay);

  // Prevent the host page from scrolling while the overlay is open.
  document.documentElement.style.overflow = "hidden";

  // Escape key closes the overlay.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.documentElement.style.removeProperty("overflow");
      document.removeEventListener("keydown", onKey, true);
    }
  };
  document.addEventListener("keydown", onKey, true);
}
