(function () {
  const pagesEl = document.getElementById("reviewPageData");
  const defaults = window.__CHRONICLE_REVIEW_DEFAULTS__ || {};
  if (!pagesEl) {
    return;
  }

  const pages = JSON.parse(pagesEl.textContent || "[]");
  const pageSelect = document.getElementById("reviewPageSelect");
  const variantInput = document.getElementById("reviewVariantInput");
  const viewportSelect = document.getElementById("reviewViewportSelect");
  const descriptionEl = document.getElementById("reviewPageDescription");
  const previewRouteEl = document.getElementById("reviewPreviewRoute");
  const leftUrlEl = document.getElementById("reviewLeftUrl");
  const rightUrlEl = document.getElementById("reviewRightUrl");
  const leftFrame = document.getElementById("reviewLeftFrame");
  const rightFrame = document.getElementById("reviewRightFrame");
  const comparisonEl = document.getElementById("reviewComparison");
  const notesEl = document.getElementById("reviewNotes");
  const loadBtn = document.getElementById("reviewLoadBtn");
  const swapBtn = document.getElementById("reviewSwapBtn");
  const copyLinkBtn = document.getElementById("reviewCopyLinkBtn");
  const clearNotesBtn = document.getElementById("reviewClearNotesBtn");

  if (
    !(pageSelect instanceof HTMLSelectElement) ||
    !(variantInput instanceof HTMLInputElement) ||
    !(viewportSelect instanceof HTMLSelectElement) ||
    !(descriptionEl instanceof HTMLElement) ||
    !(previewRouteEl instanceof HTMLElement) ||
    !(leftUrlEl instanceof HTMLElement) ||
    !(rightUrlEl instanceof HTMLElement) ||
    !(leftFrame instanceof HTMLIFrameElement) ||
    !(rightFrame instanceof HTMLIFrameElement) ||
    !(comparisonEl instanceof HTMLElement) ||
    !(notesEl instanceof HTMLTextAreaElement) ||
    !(loadBtn instanceof HTMLButtonElement) ||
    !(swapBtn instanceof HTMLButtonElement) ||
    !(copyLinkBtn instanceof HTMLButtonElement) ||
    !(clearNotesBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  function getPageByKey(key) {
    return pages.find((entry) => entry.key === key) || pages[0] || null;
  }

  function buildRightUrl(page, variant) {
    if (!page) {
      return "";
    }
    const normalizedVariant = String(variant || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "");
    if (!normalizedVariant) {
      return page.live_path;
    }
    return `${page.preview_path}?variant=${encodeURIComponent(normalizedVariant)}`;
  }

  function noteStorageKey(pageKey, variant) {
    return `chronicle:design-review:${pageKey}:${String(variant || "").trim().toLowerCase() || "live"}`;
  }

  function syncDescription(page) {
    if (!page) {
      descriptionEl.textContent = "";
      previewRouteEl.textContent = "";
      return;
    }
    descriptionEl.textContent = page.description || "";
    previewRouteEl.textContent = `${page.preview_path}?variant=${String(variantInput.value || "").trim().toLowerCase() || "a"}`;
  }

  function syncFrames() {
    const page = getPageByKey(pageSelect.value);
    if (!page) {
      return;
    }

    const leftUrl = page.live_path;
    const rightUrl = buildRightUrl(page, variantInput.value);
    leftUrlEl.textContent = leftUrl;
    rightUrlEl.textContent = rightUrl;
    leftFrame.src = leftUrl;
    rightFrame.src = rightUrl;
    syncDescription(page);
    loadNotes();
    syncPermalink(false);
  }

  function loadNotes() {
    const page = getPageByKey(pageSelect.value);
    if (!page) {
      notesEl.value = "";
      return;
    }
    notesEl.value = window.localStorage.getItem(noteStorageKey(page.key, variantInput.value)) || "";
  }

  function saveNotes() {
    const page = getPageByKey(pageSelect.value);
    if (!page) {
      return;
    }
    window.localStorage.setItem(noteStorageKey(page.key, variantInput.value), notesEl.value);
  }

  function syncPermalink(copy) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", pageSelect.value);
    params.set("variant", String(variantInput.value || "").trim().toLowerCase());
    params.set("viewport", viewportSelect.value);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
    if (copy && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  }

  function swapFrames() {
    const leftSrc = leftFrame.src;
    const rightSrc = rightFrame.src;
    const leftText = leftUrlEl.textContent || "";
    const rightText = rightUrlEl.textContent || "";
    leftFrame.src = rightSrc;
    rightFrame.src = leftSrc;
    leftUrlEl.textContent = rightText;
    rightUrlEl.textContent = leftText;
  }

  function syncViewport() {
    const mobile = viewportSelect.value === "mobile";
    comparisonEl.classList.toggle("review-comparison-mobile", mobile);
    comparisonEl.classList.toggle("review-comparison-desktop", !mobile);
  }

  function hydrateFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const pageKey = params.get("page") || defaults.page || "view";
    const variant = params.get("variant") || defaults.variant || "a";
    const viewport = params.get("viewport") || "desktop";

    for (const page of pages) {
      const option = document.createElement("option");
      option.value = page.key;
      option.textContent = page.label;
      pageSelect.appendChild(option);
    }

    pageSelect.value = getPageByKey(pageKey) ? pageKey : (pages[0] && pages[0].key) || "";
    variantInput.value = variant;
    viewportSelect.value = viewport === "mobile" ? "mobile" : "desktop";
    syncViewport();
    syncFrames();
  }

  loadBtn.addEventListener("click", syncFrames);
  swapBtn.addEventListener("click", swapFrames);
  copyLinkBtn.addEventListener("click", function () {
    syncPermalink(true);
  });
  clearNotesBtn.addEventListener("click", function () {
    notesEl.value = "";
    saveNotes();
  });
  pageSelect.addEventListener("change", syncFrames);
  variantInput.addEventListener("change", syncFrames);
  viewportSelect.addEventListener("change", function () {
    syncViewport();
    syncPermalink(false);
  });
  notesEl.addEventListener("input", saveNotes);

  hydrateFromQuery();
})();
