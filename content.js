(() => {
  if (window.__kiwiContentScriptLoaded) return;
  window.__kiwiContentScriptLoaded = true;

  let host = null;
  let shadow = null;
  let selectedText = "";
  let selectionRect = null;
  let translatedText = "";

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
        background: linear-gradient(135deg, #1f6f4a, #2a8a5d);
        color: #ffffff;
        cursor: pointer;
        padding: 0;
      }
      .trigger-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
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
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid #f0f0f0;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid #d6d6d6;
        border-radius: 4px;
        background: #f7fbf8;
        color: #1f6f4a;
        cursor: pointer;
      }
      .icon-btn:hover {
        background: #e6f1ea;
        border-color: #1f6f4a;
      }
      .icon-btn svg {
        width: 13px;
        height: 13px;
        fill: currentColor;
      }
      .card-status {
        font-size: 11px;
        color: #6b6b6b;
      }
    `;

    const container = document.createElement("div");
    container.className = "container";
    container.innerHTML = `
      <div class="bubble" id="bubble" hidden>
        <button type="button" class="trigger-btn" id="trigger" title="Kiwi Text to Speech" aria-label="Kiwi Text to Speech">
          <svg viewBox="0 0 16 16"><path d="M4 2.5 13 8l-9 5.5z"/></svg>
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
          <button type="button" class="icon-btn" id="card-speak" title="Đọc bản dịch" aria-label="Đọc bản dịch">
            <svg viewBox="0 0 16 16"><path d="M4 2.5 13 8l-9 5.5z"/></svg>
          </button>
          <span class="card-status" id="card-status"></span>
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
      bubble.hidden = true;

      showCard("Đang dịch...", selectionRect);
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

  function showBubble(rect) {
    ensureHost();
    const bubble = shadow.getElementById("bubble");
    const card = shadow.getElementById("card");
    card.hidden = true;

    bubble.classList.remove("expanded");
    bubble.hidden = false;

    let left = rect.right - 14;
    let top = rect.top - 36;

    if (top < 10) {
      top = rect.bottom + 8;
    }

    const maxLeft = window.innerWidth - 44;
    left = Math.min(Math.max(8, left), maxLeft);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function showCard(initialText, rect) {
    ensureHost();
    const card = shadow.getElementById("card");
    const cardBody = shadow.getElementById("card-body");
    cardBody.textContent = initialText;
    card.hidden = false;

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
  }

  function handleSelection() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";

    if (!text || text.length < 1) {
      hideUI();
      return;
    }

    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return;

    selectedText = text;
    selectionRect = rect;

    showBubble(rect);
  }

  document.addEventListener("mouseup", (e) => {
    if (host && e.composedPath().includes(host)) return;
    setTimeout(handleSelection, 25);
  });

  document.addEventListener("keyup", (e) => {
    if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      setTimeout(handleSelection, 50);
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (host && e.composedPath().includes(host)) return;
    hideUI();
  });
})();
