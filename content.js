(() => {
  if (window.__kiwiContentScriptLoaded) return;
  window.__kiwiContentScriptLoaded = true;

  let host = null;
  let shadow = null;
  let selectedText = "";
  let selectionRect = null;
  let translatedText = "";
  let scrollRaf = 0;

  const send = (message) => chrome.runtime.sendMessage(message);

  function ensureHost() {
    if (host) return;

    host = document.createElement("div");
    host.id = "kiwi-selection-root";
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        overflow: visible;
        pointer-events: none;
      }
      .bubble[hidden],
      .card[hidden],
      [hidden] {
        display: none !important;
      }
      .bubble {
        position: fixed;
        pointer-events: auto;
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #cddcd3;
        border-radius: 20px;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.18);
        padding: 2px;
        user-select: none;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      .trigger-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: #ffffff;
        cursor: pointer;
        padding: 0;
        overflow: hidden;
      }
      .trigger-btn img {
        width: 24px;
        height: 24px;
        display: block;
        border-radius: 50%;
        pointer-events: none;
      }
      .actions {
        display: none;
        align-items: center;
        gap: 4px;
        padding: 2px 4px;
      }
      .bubble.expanded .trigger-btn {
        display: none;
      }
      .bubble.expanded .actions {
        display: flex;
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border: 1px solid #d6d6d6;
        border-radius: 14px;
        background: #f7fbf8;
        color: #1b2c22;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }
      .action-btn:hover {
        background: #e6f1ea;
        border-color: #1f6f4a;
        color: #1f6f4a;
      }
      .action-btn svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
      .card {
        position: fixed;
        pointer-events: auto;
        width: 320px;
        max-width: calc(100vw - 24px);
        background: #ffffff;
        border: 1px solid #d6d6d6;
        border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
        padding: 12px 14px 10px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      .card-body {
        max-height: 180px;
        overflow-y: auto;
        font-size: 13px;
        line-height: 1.5;
        color: #1c1c1c;
        white-space: pre-wrap;
        word-break: break-word;
        user-select: text;
      }
      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
      }
      .card-footer .icon-btn {
        margin-left: auto;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: none;
        color: #1f6f4a;
        cursor: pointer;
      }
      .icon-btn:hover {
        background: #e6f1ea;
      }
      .icon-btn svg {
        width: 16px;
        height: 16px;
      }
      .card-status {
        font-size: 11px;
        color: #6b6b6b;
      }
    `;

    const iconUrl = chrome.runtime.getURL("icons/icon32.png");

    const container = document.createElement("div");
    container.className = "container";
    container.innerHTML = `
      <div class="bubble" id="bubble" hidden>
        <button type="button" class="trigger-btn" id="trigger" title="Kiwi Text to Speech" aria-label="Kiwi Text to Speech">
          <img src="${iconUrl}" alt="Kiwi Text to Speech" />
        </button>
        <div class="actions" id="actions">
          <button type="button" class="action-btn" id="speak-btn" title="Đọc văn bản" aria-label="Đọc văn bản">
            <svg viewBox="0 0 16 16"><path d="M4 2.5 13 8l-9 5.5z"/></svg>
            <span>Đọc</span>
          </button>
          <button type="button" class="action-btn" id="translate-btn" title="Dịch văn bản" aria-label="Dịch văn bản">
            <svg viewBox="0 0 16 16"><path d="M2.5 5.5h10.5M9.5 2.5l3.5 3-3.5 3M13.5 10.5H3M6.5 7.5l-3.5 3 3.5 3"/></svg>
            <span>Dịch</span>
          </button>
        </div>
      </div>

      <div class="card" id="card" hidden>
        <div class="card-body" id="card-body"></div>
        <div class="card-footer">
          <span class="card-status" id="card-status"></span>
          <button type="button" class="icon-btn" id="card-speak" title="Đọc bản dịch" aria-label="Đọc bản dịch">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M7.5 2.5 4 5.5H1.5v5H4l3.5 3v-11z" fill="currentColor"/>
              <path d="M10.5 5a3.5 3.5 0 0 1 0 6M12.5 3a6.5 6.5 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    shadow.append(style, container);
    document.documentElement.append(host);

    bindEvents();
  }

  function bindEvents() {
    const bubble = shadow.getElementById("bubble");
    const trigger = shadow.getElementById("trigger");
    const speakBtn = shadow.getElementById("speak-btn");
    const translateBtn = shadow.getElementById("translate-btn");
    const card = shadow.getElementById("card");
    const cardBody = shadow.getElementById("card-body");
    const cardSpeak = shadow.getElementById("card-speak");
    const cardStatus = shadow.getElementById("card-status");

    bubble.addEventListener("mousedown", (e) => e.stopPropagation());
    card.addEventListener("mousedown", (e) => e.stopPropagation());

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      bubble.classList.add("expanded");
      if (selectionRect) {
        positionBubble(selectionRect);
      }
    });

    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = selectedText;
      hideUI();
      if (text) send({ type: "speak", text });
    });

    translateBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const text = selectedText;
      const rect = selectionRect;
      bubble.hidden = true;

      showCard("Đang dịch...", rect);
      cardStatus.textContent = "Đang dịch";

      try {
        const result = await send({ type: "translateSelection", text });
        if (result && result.ok && result.translation) {
          translatedText = result.translation;
          cardBody.textContent = translatedText;
          cardStatus.textContent = "";
        } else {
          cardBody.textContent = result?.message || "Không dịch được";
          cardStatus.textContent = "Lỗi";
        }
      } catch (err) {
        cardBody.textContent = "Lỗi dịch: " + err.message;
        cardStatus.textContent = "Lỗi";
      }
    });

    cardSpeak.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!translatedText) return;
      cardStatus.textContent = "Đang đọc";
      send({ type: "speak", text: translatedText });
    });
  }

  function positionBubble(rect) {
    if (!shadow || !rect) return;
    const bubble = shadow.getElementById("bubble");
    if (!bubble) return;

    let left = rect.right - 14;
    let top = rect.top - 36;

    if (top < 10) {
      top = rect.bottom + 8;
    }

    const isExpanded = bubble.classList.contains("expanded");
    const maxLeft = window.innerWidth - (isExpanded ? 160 : 44);
    left = Math.min(Math.max(8, left), maxLeft);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function positionCard(rect) {
    if (!shadow || !rect) return;
    const card = shadow.getElementById("card");
    if (!card) return;

    let left = rect.left;
    let top = rect.top - 150;

    if (top < 10) {
      top = rect.bottom + 10;
    }

    const maxLeft = window.innerWidth - 332;
    left = Math.min(Math.max(10, left), maxLeft);

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function showBubble(rect) {
    ensureHost();
    const bubble = shadow.getElementById("bubble");
    const card = shadow.getElementById("card");
    card.hidden = true;

    bubble.classList.remove("expanded");
    bubble.hidden = false;

    positionBubble(rect);
  }

  function showCard(initialText, rect) {
    ensureHost();
    const card = shadow.getElementById("card");
    const cardBody = shadow.getElementById("card-body");
    cardBody.textContent = initialText;
    card.hidden = false;

    if (rect) {
      positionCard(rect);
    }
  }

  function hideUI() {
    if (!shadow) return;
    const bubble = shadow.getElementById("bubble");
    const card = shadow.getElementById("card");
    if (bubble) {
      bubble.hidden = true;
      bubble.classList.remove("expanded");
    }
    if (card) {
      card.hidden = true;
    }
    translatedText = "";
    selectedText = "";
    selectionRect = null;
  }

  function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      hideUI();
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 1) {
      hideUI();
      return;
    }

    if (selection.rangeCount === 0) {
      hideUI();
      return;
    }

    const range = selection.getRangeAt(0);
    if (host && host.contains(range.commonAncestorContainer)) {
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideUI();
      return;
    }

    selectedText = text;
    selectionRect = rect;

    showBubble(rect);
  }

  function updatePosition() {
    if (!shadow) return;
    const bubble = shadow.getElementById("bubble");
    const card = shadow.getElementById("card");
    const bubbleVisible = bubble && !bubble.hidden;
    const cardVisible = card && !card.hidden;

    if (!bubbleVisible && !cardVisible) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim() || selection.rangeCount === 0) {
      hideUI();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      hideUI();
      return;
    }

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      hideUI();
      return;
    }

    selectionRect = rect;
    if (bubbleVisible) {
      positionBubble(rect);
    }
    if (cardVisible) {
      positionCard(rect);
    }
  }

  function handleScrollOrResize() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updatePosition();
    });
  }

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hideUI();
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (host && e.composedPath().includes(host)) return;
    hideUI();
  });

  document.addEventListener("mouseup", (e) => {
    if (host && e.composedPath().includes(host)) return;
    setTimeout(handleSelection, 20);
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      hideUI();
      return;
    }
    if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      setTimeout(handleSelection, 40);
    }
  });

  window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
  window.addEventListener("resize", handleScrollOrResize, { passive: true });
})();
