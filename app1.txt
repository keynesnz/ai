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

function md(s) {
  s = esc(s);

  s = s.replace(
    /```([\s\S]*?)```/g,
    (_, x) =>
      `<pre><code>${x.trim()}</code></pre>`
  );

  s = s.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  s = s.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  s = s.replace(
    /\n\n/g,
    "<br><br>"
  );

  s = s.replace(
    /\n/g,
    "<br>"
  );

  return s;
}

function render() {
  const c = $("chat");

  if (!messages.length) {
    c.innerHTML = `
      <div class="welcome">
        <div class="welcome-logo">✦</div>

        <h1>Halo! Saya Geraikita AI.</h1>

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

  c.innerHTML = messages
    .map(m =>
      m.role === "user"
        ? `
          <div class="msg user">
            <div class="bubble">
              ${md(m.content)}
            </div>
          </div>
        `
        : `
          <div class="msg assistant">
            <div class="avatar">G</div>
            <div class="bubble">
              ${md(m.content)}
            </div>
          </div>
        `
    )
    .join("");

  c.scrollTop = c.scrollHeight;
}

function save() {
  localStorage.setItem(
    CHATS_KEY,
    JSON.stringify(chats.slice(-30))
  );

  $("history").innerHTML = chats
    .map(
      (x, i) =>
        `<button data-i="${i}">${esc(x.title)}</button>`
    )
    .join("");
}

function openSettings() {
  $("workerUrl").value =
    localStorage.getItem(CFG_KEY) ||
    DEFAULT_WORKER;

  $("system").value =
    localStorage.getItem(SYS_KEY) || "";

  $("modal").classList.remove("hidden");
}

async function send(text) {
  let url =
    localStorage.getItem(CFG_KEY) ||
    DEFAULT_WORKER;

  url = url.replace(/\/+$/, "");

  if (!/^https:\/\//i.test(url)) {
    alert("URL Worker harus diawali https://");
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

  try {
    const system =
      localStorage.getItem(SYS_KEY) || "";

    const model =
      $("model").value;

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
        .filter(x => x.content)
        .map(x => ({
          role: x.role,
          content: x.content
        }))
    ];

    const payload = {
      model,
      messages: apiMessages,
      stream: false
    };

    const r = await fetch(
      `${url}/v1/chat/completions`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    let data;

    try {
      data = await r.json();
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

    assistant.content = content;

  } catch (e) {

    assistant.content =
      `⚠️ ${e.message || "Request gagal"}`;

  }

  render();

  busy = false;
  $("send").disabled = false;

  if (
    messages.length === 2 &&
    messages[0]?.role === "user"
  ) {
    chats.push({
      title: text.slice(0, 55),
      messages: JSON.parse(
        JSON.stringify(messages)
      )
    });

    save();
  }
}

$("form").onsubmit = e => {
  e.preventDefault();

  const t = $("input").value.trim();

  if (!t) return;

  $("input").value = "";
  $("input").style.height = "auto";

  send(t);
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
  $("input").style.height = "auto";

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
  $("modal").classList.add("hidden");
};

$("menuBtn").onclick = () => {
  $("sidebar").classList.toggle("open");
};

$("save").onclick = () => {
  const u =
    $("workerUrl").value.trim();

  if (u) {
    localStorage.setItem(
      CFG_KEY,
      u
    );
  } else {
    localStorage.removeItem(CFG_KEY);
  }

  localStorage.setItem(
    SYS_KEY,
    $("system").value
  );

  $("modal").classList.add("hidden");
};

$("reset").onclick = () => {
  localStorage.removeItem(CFG_KEY);
  localStorage.removeItem(SYS_KEY);

  $("workerUrl").value =
    DEFAULT_WORKER;

  $("system").value = "";
};

document.addEventListener(
  "click",
  e => {

    const p =
      e.target.closest("[data-p]");

    if (p) {
      $("input").value =
        p.dataset.p;

      $("input").focus();
    }

    const h =
      e.target.closest("[data-i]");

    if (h) {
      messages =
        JSON.parse(
          JSON.stringify(
            chats[+h.dataset.i].messages
          )
        );

      render();
    }

  }
);

save();
render();
