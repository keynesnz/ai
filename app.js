const $ = id => document.getElementById(id);

const CFG_KEY = "gk_worker_url";
const SYS_KEY = "gk_system";
const CHATS_KEY = "gk_chats";

const DEFAULT_WORKER =
  "https://purple-dew-e090.sabar-41c.workers.dev";

let messages = [];
let chats = JSON.parse(
  localStorage.getItem(CHATS_KEY) || "[]"
);

let busy = false;
let progressTimer = null;
let progressStarted = 0;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

/*
 * Escape HTML first, then format basic markdown.
 * Code blocks are handled separately so copy buttons
 * can access the original code.
 */
function md(s) {
  let source = String(s);

  const blocks = [];

  source = source.replace(
    /```([^\n]*)\n([\s\S]*?)```/g,
    (_, language, code) => {
      const index = blocks.length;

      blocks.push({
        language: language.trim(),
        code: code.trim()
      });

      return `@@CODEBLOCK_${index}@@`;
    }
  );

  source = esc(source);

  source = source.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  source = source.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  source = source.replace(
    /\n\n/g,
    "<br><br>"
  );

  source = source.replace(
    /\n/g,
    "<br>"
  );

  blocks.forEach((block, index) => {

    const language =
      block.language || "code";

    const codeHtml = esc(block.code);

    const html = `
      <div class="code-wrapper">

        <div class="code-tools">

          <span>${esc(language)}</span>

          <button
            type="button"
            class="copy-code"
            data-code-index="${index}"
          >
            Copy
          </button>

        </div>

        <pre><code>${codeHtml}</code></pre>

      </div>
    `;

    source = source.replace(
      `@@CODEBLOCK_${index}@@`,
      html
    );
  });

  return source;
}

function extractCodeBlocks(text) {

  const blocks = [];

  String(text).replace(
    /```[^\n]*\n([\s\S]*?)```/g,
    (_, code) => {
      blocks.push(code.trim());
      return _;
    }
  );

  return blocks;
}

function copyText(text, button) {

  navigator.clipboard.writeText(text)
    .then(() => {

      if (!button) return;

      const old =
        button.textContent;

      button.textContent =
        "✓ Copied";

      setTimeout(() => {
        button.textContent = old;
      }, 1500);

    })
    .catch(() => {

      const area =
        document.createElement("textarea");

      area.value = text;

      document.body.appendChild(area);

      area.select();

      document.execCommand("copy");

      area.remove();

      if (button) {
        const old =
          button.textContent;

        button.textContent =
          "✓ Copied";

        setTimeout(() => {
          button.textContent = old;
        }, 1500);
      }
    });
}

function addCopyAllControls(html, content) {

  const blocks =
    extractCodeBlocks(content);

  if (!blocks.length) {
    return html;
  }

  const allCode =
    blocks.join("\n\n");

  const button = `
    <div class="copy-all-wrap">
      <button
        type="button"
        class="copy-all-code"
        data-all-code="${encodeURIComponent(allCode)}"
      >
        📋 Copy all code
      </button>
    </div>
  `;

  /*
   * Put one button before and one after the answer.
   */
  return button + html + button;
}

function render() {

  const c = $("chat");

  if (!messages.length) {

    c.innerHTML = `
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

          <button data-p="Jelaskan artificial intelligence dengan sederhana">
            Jelaskan AI
          </button>

          <button data-p="Bantu saya membuat rencana belajar pemrograman">
            Buat rencana belajar
          </button>

          <button data-p="Tulis contoh kode HTML sederhana">
            Tulis contoh kode
          </button>

        </div>

      </div>
    `;

    return;
  }

  c.innerHTML = messages.map(m => {

    if (m.role === "user") {

      return `
        <div class="msg user">
          <div class="bubble">
            ${esc(m.content)}
          </div>
        </div>
      `;
    }

    let content =
      md(m.content || "");

    content =
      addCopyAllControls(
        content,
        m.content || ""
      );

    return `
      <div class="msg assistant">

        <div class="avatar">
          G
        </div>

        <div class="bubble">
          ${content}
        </div>

      </div>
    `;

  }).join("");

  /*
   * If currently waiting, show progress indicator
   * after the assistant bubble.
   */
  if (busy) {

    const last =
      c.querySelector(
        ".msg.assistant:last-child .bubble"
      );

    if (last) {
      last.insertAdjacentHTML(
        "beforeend",
        progressHTML()
      );
    }
  }

  c.scrollTop = c.scrollHeight;
}

function progressHTML() {

  const seconds =
    Math.max(
      0,
      Math.floor(
        (Date.now() - progressStarted) / 1000
      )
    );

  return `
    <div class="progress-wrap">

      <div class="progress-top">

        <span>
          <span class="waiting-dots">
            Menunggu respons
          </span>
        </span>

        <span>
          ${seconds}s
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

      const c =
        $("chat");

      const old =
        c.querySelector(
          ".progress-wrap"
        );

      if (!old) return;

      old.outerHTML =
        progressHTML();

      c.scrollTop =
        c.scrollHeight;

    }, 1000);
}

function stopProgress() {

  clearInterval(
    progressTimer
  );

  progressTimer = null;
}

function save() {

  localStorage.setItem(
    CHATS_KEY,
    JSON.stringify(
      chats.slice(-30)
    )
  );

  $("history").innerHTML =
    chats.map(
      (x, i) =>
        `<button data-i="${i}">
          ${esc(x.title)}
        </button>`
    ).join("");
}

function openSettings() {

  $("workerUrl").value =
    localStorage.getItem(
      CFG_KEY
    ) || DEFAULT_WORKER;

  $("system").value =
    localStorage.getItem(
      SYS_KEY
    ) || "";

  $("modal")
    .classList
    .remove("hidden");
}

async function send(text) {

  let url =
    localStorage.getItem(
      CFG_KEY
    ) || DEFAULT_WORKER;

  url =
    url.replace(/\/+$/, "");

  if (!/^https:\/\//i.test(url)) {

    alert(
      "URL Worker harus diawali https://"
    );

    return;
  }

  if (busy) return;

  busy = true;

  $("send").disabled = true;

  messages.push({
    role: "user",
    content: text
  });

  const assistant = {
    role: "assistant",
    content: ""
  };

  messages.push(assistant);

  render();

  startProgress();

  try {

    const system =
      localStorage.getItem(
        SYS_KEY
      ) || "";

    const payload = {

      model:
        $("model").value,

      messages: [
        ...(system
          ? [{
              role: "system",
              content: system
            }]
          : []),

        ...messages
          .filter(x => x.content)
          .map(x => ({
            role: x.role,
            content: x.content
          }))
      ],

      stream: false
    };

    const r =
      await fetch(
        url +
        "/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    let data;

    try {

      data =
        await r.json();

    } catch {

      throw new Error(
        `Server mengembalikan respons tidak valid (HTTP ${r.status})`
      );
    }

    if (!r.ok) {

      throw new Error(
        data?.error?.message ||
        data?.message ||
        `HTTP ${r.status}`
      );
    }

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) {

      throw new Error(
        "API tidak mengembalikan isi respons."
      );
    }

    assistant.content =
      content;

  } catch (e) {

    assistant.content =
      `⚠️ ${e.message || "Request gagal"}`;

  }

  stopProgress();

  busy = false;

  $("send").disabled = false;

  render();

  if (
    messages.length === 2 &&
    messages[0]?.role === "user"
  ) {

    chats.push({
      title:
        text.slice(0, 55),

      messages:
        JSON.parse(
          JSON.stringify(messages)
        )
    });

    save();
  }
}

$("form").onsubmit = e => {

  e.preventDefault();

  const text =
    $("input")
      .value
      .trim();

  if (!text) return;

  $("input").value = "";

  $("input").style.height =
    "auto";

  send(text);
};

$("input").onkeydown = e => {

  if (
    e.key === "Enter" &&
    !e.shiftKey
  ) {

    e.preventDefault();

    $("form").requestSubmit();
  }
};

$("input").oninput = () => {

  $("input").style.height =
    "auto";

  $("input").style.height =
    Math.min(
      $("input").scrollHeight,
      160
    ) + "px";
};

$("newChat").onclick = () => {

  messages = [];

  render();
};

$("clear").onclick = () => {

  messages = [];

  render();
};

$("settingsBtn").onclick =
  openSettings;

$("close").onclick = () => {

  $("modal")
    .classList
    .add("hidden");
};

$("menuBtn").onclick = () => {

  $("sidebar")
    .classList
    .toggle("open");
};

$("save").onclick = () => {

  const u =
    $("workerUrl")
      .value
      .trim();

  if (u) {

    localStorage.setItem(
      CFG_KEY,
      u
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

$("reset").onclick = () => {

  localStorage.removeItem(
    CFG_KEY
  );

  localStorage.removeItem(
    SYS_KEY
  );

  $("workerUrl").value =
    DEFAULT_WORKER;

  $("system").value = "";
};

document.addEventListener(
  "click",
  e => {

    const suggestion =
      e.target.closest(
        "[data-p]"
      );

    if (suggestion) {

      $("input").value =
        suggestion.dataset.p;

      $("input").focus();
    }

    const history =
      e.target.closest(
        "[data-i]"
      );

    if (history) {

      messages =
        JSON.parse(
          JSON.stringify(
            chats[
              +history.dataset.i
            ].messages
          )
        );

      render();
    }

    const copyButton =
      e.target.closest(
        ".copy-code"
      );

    if (copyButton) {

      const wrapper =
        copyButton.closest(
          ".code-wrapper"
        );

      const code =
        wrapper
          ?.querySelector("code")
          ?.textContent || "";

      copyText(
        code,
        copyButton
      );
    }

    const copyAll =
      e.target.closest(
        ".copy-all-code"
      );

    if (copyAll) {

      const code =
        decodeURIComponent(
          copyAll.dataset.allCode
        );

      copyText(
        code,
        copyAll
      );
    }

  }
);

save();
render();
