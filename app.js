const $ = id => document.getElementById(id);


/* =========================================================
   CONFIG
   ========================================================= */

const CFG_KEY = "gk_worker_url";
const SYS_KEY = "gk_system";
const CHATS_KEY = "gk_chats";

const DEFAULT_WORKER =
  "https://purple-dew-e090.sabar-41c.workers.dev";


/* =========================================================
   STATE
   ========================================================= */

let messages = [];

let chats = JSON.parse(
  localStorage.getItem(CHATS_KEY) || "[]"
);

let busy = false;

let progressTimer = null;

let progressStarted = 0;


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function esc(value) {

  return String(value).replace(
    /[&<>"']/g,

    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}


/* =========================================================
   MARKDOWN + CODE BLOCK RENDERER
   ========================================================= */

function md(text) {

  let source =
    String(text || "");

  const codeBlocks = [];


  /*
   * Find fenced Markdown code blocks.
   *
   * Example:
   *
   * ```javascript
   * console.log("hello");
   * ```
   */

  source = source.replace(
    /```([^\n]*)\n([\s\S]*?)```/g,

    (_, language, code) => {

      const index =
        codeBlocks.length;

      codeBlocks.push({
        language:
          language.trim() || "code",

        code:
          code.trim()
      });

      return `@@CODEBLOCK_${index}@@`;
    }
  );


  /*
   * Escape normal text.
   */

  source = esc(source);


  /*
   * Inline code.
   */

  source = source.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );


  /*
   * Bold.
   */

  source = source.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );


  /*
   * New lines.
   */

  source = source.replace(
    /\n\n/g,
    "<br><br>"
  );

  source = source.replace(
    /\n/g,
    "<br>"
  );


  /*
   * Restore code blocks.
   */

  codeBlocks.forEach(
    (block, index) => {

      const language =
        esc(block.language);

      const code =
        esc(block.code);

      const html = `
        <div class="code-wrapper">

          <div class="code-tools">

            <span>
              ${language}
            </span>

            <button
              type="button"
              class="copy-code"
              data-code="${encodeURIComponent(block.code)}"
            >
              📋 Copy
            </button>

          </div>

          <pre><code>${code}</code></pre>

        </div>
      `;

      source =
        source.replace(
          `@@CODEBLOCK_${index}@@`,
          html
        );
    }
  );


  return source;
}


/* =========================================================
   EXTRACT CODE
   ========================================================= */

function extractCode(text) {

  const blocks = [];

  const source =
    String(text || "");


  /*
   * Extract every fenced code block.
   */

  source.replace(
    /```[^\n]*\n([\s\S]*?)```/g,

    (_, code) => {

      blocks.push(
        code.trim()
      );

      return "";
    }
  );


  /*
   * If fenced code exists,
   * return only the code.
   */

  if (blocks.length) {

    return blocks.join(
      "\n\n"
    );
  }


  /*
   * No fenced code.
   *
   * Return the complete AI output.
   */

  return source.trim();
}


/* =========================================================
   COPY
   ========================================================= */

function copyText(text, button) {

  if (!text) return;


  const success =
    () => {

      if (!button) return;

      const original =
        button.textContent;

      button.textContent =
        "✓ Copied";

      button.classList.add(
        "copy-success"
      );

      setTimeout(() => {

        button.textContent =
          original;

        button.classList.remove(
          "copy-success"
        );

      }, 1500);
    };


  /*
   * Modern Clipboard API.
   */

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {

    navigator.clipboard
      .writeText(text)
      .then(success)
      .catch(() => {
        fallbackCopy(
          text,
          success
        );
      });

    return;
  }


  fallbackCopy(
    text,
    success
  );
}


function fallbackCopy(
  text,
  callback
) {

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value =
    text;

  textarea.style.position =
    "fixed";

  textarea.style.left =
    "-9999px";

  textarea.style.top =
    "-9999px";

  document.body.appendChild(
    textarea
  );

  textarea.focus();

  textarea.select();

  try {

    document.execCommand(
      "copy"
    );

    callback();

  } catch {

    alert(
      "Tidak dapat menyalin otomatis. Silakan copy secara manual."
    );

  }

  textarea.remove();
}


/* =========================================================
   PROGRESS
   ========================================================= */

function progressHTML() {

  const elapsed =
    Math.floor(
      (Date.now() -
        progressStarted) /
      1000
    );

  return `
    <div class="progress-wrap">

      <div class="progress-top">

        <span class="progress-label">

          <span class="waiting-dots">
            Menunggu respons
          </span>

        </span>

        <span>
          ${elapsed}s
        </span>

      </div>

      <div class="progress-bar"></div>

    </div>
  `;
}


function startProgress() {

  progressStarted =
    Date.now();


  clearInterval(
    progressTimer
  );


  progressTimer =
    setInterval(() => {

      if (!busy) return;


      const progress =
        document.querySelector(
          ".progress-wrap"
        );


      if (!progress) return;


      progress.outerHTML =
        progressHTML();


    }, 1000);
}


function stopProgress() {

  clearInterval(
    progressTimer
  );

  progressTimer =
    null;
}


/* =========================================================
   RENDER CHAT
   ========================================================= */

function render() {

  const chat =
    $("chat");


  /*
   * Empty state.
   */

  if (!messages.length) {

    chat.innerHTML = `

      <div class="welcome">

        <div class="welcome-logo">
          ✦
        </div>

        <h1>
          Halo! Saya Geraikita AI.
        </h1>

        <p>
          Pilih model lalu mulai percakapan.
        </p>

        <div class="suggestions">

          <button
            type="button"
            data-p="Jelaskan artificial intelligence dengan sederhana"
          >
            Jelaskan AI
          </button>

          <button
            type="button"
            data-p="Bantu saya membuat rencana belajar pemrograman"
          >
            Buat rencana belajar
          </button>

          <button
            type="button"
            data-p="Tulis contoh kode HTML sederhana"
          >
            Tulis contoh kode
          </button>

        </div>

      </div>
    `;

    return;
  }


  /*
   * Render every message.
   */

  chat.innerHTML =
    messages.map(
      (message, index) => {

        /*
         * USER
         */

        if (
          message.role ===
          "user"
        ) {

          return `
            <div class="msg user">

              <div class="bubble">
                ${esc(
                  message.content
                )}
              </div>

            </div>
          `;
        }


        /*
         * ASSISTANT
         */

        const content =
          message.content || "";


        const rendered =
          md(content);


        return `
          <div class="msg assistant">

            <div class="avatar">
              G
            </div>

            <div class="bubble">

              <div class="assistant-toolbar">

                <button
                  type="button"
                  class="copy-entire-response"
                  data-message-index="${index}"
                >
                  📋 Copy entire output
                </button>

              </div>

              <div class="assistant-content">
                ${rendered}
              </div>

            </div>

          </div>
        `;

      }
    ).join("");


  /*
   * Waiting indicator.
   */

  if (busy) {

    const lastAssistant =
      chat.querySelector(
        ".msg.assistant:last-child .bubble"
      );


    if (lastAssistant) {

      lastAssistant.insertAdjacentHTML(
        "beforeend",
        progressHTML()
      );
    }
  }


  /*
   * Scroll to bottom.
   */

  chat.scrollTop =
    chat.scrollHeight;
}


/* =========================================================
   SAVE CHAT HISTORY
   ========================================================= */

function save() {

  localStorage.setItem(
    CHATS_KEY,

    JSON.stringify(
      chats.slice(-30)
    )
  );


  $("history").innerHTML =
    chats.map(
      (chat, index) => `

        <button
          type="button"
          data-history-index="${index}"
        >
          ${esc(
            chat.title
          )}
        </button>

      `
    ).join("");
}


/* =========================================================
   SETTINGS
   ========================================================= */

function openSettings() {

  $("workerUrl").value =
    localStorage.getItem(
      CFG_KEY
    ) ||
    DEFAULT_WORKER;


  $("system").value =
    localStorage.getItem(
      SYS_KEY
    ) ||
    "";


  $("modal")
    .classList
    .remove("hidden");
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function send(text) {

  let url =
    localStorage.getItem(
      CFG_KEY
    ) ||
    DEFAULT_WORKER;


  /*
   * Remove trailing slash.
   */

  url =
    url.replace(
      /\/+$/,
      ""
    );


  /*
   * Validate URL.
   */

  if (
    !/^https:\/\//i.test(
      url
    )
  ) {

    alert(
      "URL Worker harus diawali https://"
    );

    return;
  }


  /*
   * Prevent duplicate requests.
   */

  if (busy) return;


  busy = true;

  $("send").disabled =
    true;


  /*
   * Add user message.
   */

  messages.push({
    role: "user",
    content: text
  });


  /*
   * Empty assistant message.
   */

  const assistant = {

    role: "assistant",

    content: ""

  };


  messages.push(
    assistant
  );


  render();

  startProgress();


  try {

    const system =
      localStorage.getItem(
        SYS_KEY
      ) ||
      "";


    const model =
      $("model").value;


    /*
     * Build API messages.
     */

    const apiMessages = [

      ...(system
        ? [
            {
              role: "system",
              content: system
            }
          ]
        : []),

      ...messages
        .filter(
          message =>
            message.content
        )
        .map(
          message => ({
            role:
              message.role,

            content:
              message.content
          })
        )

    ];


    /*
     * API payload.
     */

    const payload = {

      model,

      messages:
        apiMessages,

      stream:
        false

    };


    /*
     * Request.
     */

    const response =
      await fetch(
        url +
        "/v1/chat/completions",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify(
              payload
            )

        }
      );


    /*
     * Parse response.
     */

    let data;


    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        `Server mengembalikan respons tidak valid (HTTP ${response.status})`
      );
    }


    /*
     * API error.
     */

    if (
      !response.ok
    ) {

      throw new Error(

        data?.error?.message ||

        data?.message ||

        `HTTP ${response.status}`

      );
    }


    /*
     * Extract answer.
     */

    const content =
      data
        ?.choices
        ?. [0]
        ?.message
        ?.content;


    if (
      !content
    ) {

      throw new Error(
        "API tidak mengembalikan isi respons."
      );
    }


    /*
     * Save answer.
     */

    assistant.content =
      content;


  } catch (error) {

    assistant.content =
      `⚠️ ${
        error?.message ||
        "Request gagal"
      }`;

  }


  /*
   * Finish progress.
   */

  stopProgress();


  busy = false;

  $("send").disabled =
    false;


  /*
   * Render final response.
   */

  render();


  /*
   * Save conversation.
   */

  if (
    messages.length ===
      2 &&
    messages[0]?.role ===
      "user"
  ) {

    chats.push({

      title:
        text.slice(
          0,
          55
        ),

      messages:
        JSON.parse(
          JSON.stringify(
            messages
          )
        )

    });


    save();
  }
}


/* =========================================================
   FORM
   ========================================================= */

$("form").onsubmit =
  event => {

    event.preventDefault();


    const text =
      $("input")
        .value
        .trim();


    if (!text) return;


    $("input").value =
      "";

    $("input").style.height =
      "auto";


    send(text);
  };


/* =========================================================
   ENTER / SHIFT+ENTER
   ========================================================= */

$("input").onkeydown =
  event => {

    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      $("form")
        .requestSubmit();
    }
  };


/* =========================================================
   AUTO RESIZE TEXTAREA
   ========================================================= */

$("input").oninput =
  () => {

    $("input").style.height =
      "auto";


    $("input").style.height =
      Math.min(
        $("input").scrollHeight,
        160
      ) +
      "px";
  };


/* =========================================================
   NEW CHAT
   ========================================================= */

$("newChat").onclick =
  () => {

    messages = [];

    render();
  };


/* =========================================================
   CLEAR CHAT
   ========================================================= */

$("clear").onclick =
  () => {

    messages = [];

    render();
  };


/* =========================================================
   OPEN SETTINGS
   ========================================================= */

$("settingsBtn").onclick =
  openSettings;


/* =========================================================
   CLOSE SETTINGS
   ========================================================= */

$("close").onclick =
  () => {

    $("modal")
      .classList
      .add("hidden");
  };


/* =========================================================
   MOBILE MENU
   ========================================================= */

$("menuBtn").onclick =
  () => {

    $("sidebar")
      .classList
      .toggle("open");
  };


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

$("save").onclick =
  () => {

    const url =
      $("workerUrl")
        .value
        .trim();


    if (url) {

      localStorage.setItem(
        CFG_KEY,
        url
      );

    } else {

      localStorage.removeItem(
        CFG_KEY
      );
    }


    localStorage.setItem(
      SYS_KEY,
      $("system").value
    );


    $("modal")
      .classList
      .add("hidden");
  };


/* =========================================================
   RESET SETTINGS
   ========================================================= */

$("reset").onclick =
  () => {

    localStorage.removeItem(
      CFG_KEY
    );

    localStorage.removeItem(
      SYS_KEY
    );


    $("workerUrl").value =
      DEFAULT_WORKER;


    $("system").value =
      "";
  };


/* =========================================================
   GLOBAL CLICK HANDLER
   ========================================================= */

document.addEventListener(
  "click",
  event => {


    /*
     * Suggestion buttons.
     */

    const suggestion =
      event.target.closest(
        "[data-p]"
      );


    if (suggestion) {

      $("input").value =
        suggestion.dataset.p;

      $("input").focus();

      return;
    }


    /*
     * Chat history.
     */

    const historyButton =
      event.target.closest(
        "[data-history-index]"
      );


    if (historyButton) {

      const index =
        Number(
          historyButton
            .dataset
            .historyIndex
        );


      if (
        chats[index]
      ) {

        messages =
          JSON.parse(
            JSON.stringify(
              chats[index]
                .messages
            )
          );

        render();
      }

      return;
    }


    /*
     * Individual code copy.
     */

    const copyCodeButton =
      event.target.closest(
        ".copy-code"
      );


    if (copyCodeButton) {

      const code =
        decodeURIComponent(
          copyCodeButton
            .dataset
            .code
        );


      copyText(
        code,
        copyCodeButton
      );

      return;
    }


    /*
     * Entire assistant output.
     */

    const copyEntireButton =
      event.target.closest(
        ".copy-entire-response"
      );


    if (copyEntireButton) {

      const index =
        Number(
          copyEntireButton
            .dataset
            .messageIndex
        );


      const message =
        messages[index];


      if (
        message &&
        message.content
      ) {

        /*
         * If response contains fenced
         * code, copy only code.
         *
         * Otherwise copy entire output.
         */

        const output =
          extractCode(
            message.content
          );


        copyText(
          output,
          copyEntireButton
        );
      }

      return;
    }

  }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

save();

render();
