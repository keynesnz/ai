const API_BASE="https://ai.geraikita.com/v1";
const $=id=>document.getElementById(id);
let conversations=JSON.parse(localStorage.getItem("gk_chats")||"[]");
let messages=[];
let busy=false;

function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function md(s){
  s=esc(s);
  s=s.replace(/```([\s\S]*?)```/g,(_,x)=>`<pre><code>${x.trim()}</code></pre>`);
  s=s.replace(/`([^`]+)`/g,"<code>$1</code>");
  s=s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  s=s.replace(/\*([^*]+)\*/g,"<em>$1</em>");
  s=s.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>");
  s=s.replace(/^\s*[-*] (.*)$/gm,"<li>$1</li>");
  s=s.replace(/\n\n/g,"<br><br>").replace(/\n/g,"<br>");
  return s.replace(/(<li>.*?<\/li>)(?:<br>)?/g,"$1");
}
function render(){
  const chat=$("chat");
  if(!messages.length){chat.innerHTML=`<div class="welcome" id="welcome"><div class="welcome-logo">✦</div><h1>Halo! Saya Geraikita AI.</h1><p>Tanyakan apa saja. Masukkan API key Anda di Pengaturan untuk mulai.</p><div class="suggestions"><button data-prompt="Jelaskan artificial intelligence dengan sederhana">Jelaskan AI dengan sederhana</button><button data-prompt="Bantu saya membuat rencana belajar pemrograman">Buat rencana belajar</button><button data-prompt="Tulis contoh kode HTML sederhana">Tulis contoh kode</button></div></div>`;return}
  chat.innerHTML=messages.map(m=>m.role==="user"
    ?`<div class="message user"><div class="bubble">${md(m.content)}</div></div>`
    :`<div class="message assistant"><div class="avatar">G</div><div class="bubble">${md(m.content)}</div></div>`).join("");
  chat.scrollTop=chat.scrollHeight;
}
function save(){localStorage.setItem("gk_chats",JSON.stringify(conversations.slice(-30)));}
function addHistory(){
  $("history").innerHTML=conversations.map((c,i)=>`<button data-i="${i}">${esc(c.title||"Chat")}</button>`).join("");
}
function currentKey(){return localStorage.getItem("gk_api_key")||"";}
function requireKey(){
  if(currentKey()) return true;
  openSettings();
  alert("Masukkan API key Geraikita di Pengaturan terlebih dahulu.");
  return false;
}
async function send(text){
  if(!text||busy)return;
  if(!requireKey())return;
  busy=true;$("send").disabled=true;
  messages.push({role:"user",content:text});render();
  const placeholder={role:"assistant",content:""};
  messages.push(placeholder);render();
  const system=$("systemPrompt").value.trim();
  const payload={model:$("model").value,messages:[...(system?[{role:"system",content:system}]:[]),...messages.filter(m=>m.content)]};
  try{
    const r=await fetch(API_BASE+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+currentKey()},body:JSON.stringify(payload)});
    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||`HTTP ${r.status}`);
    placeholder.content=data.choices?.[0]?.message?.content||"Tidak ada respons.";
  }catch(e){placeholder.content="⚠️ Gagal: "+e.message}
  messages=messages.filter(m=>m.content!==""||m===placeholder);
  render();busy=false;$("send").disabled=false;
  if(messages.length===2){conversations.push({title:text.slice(0,50),messages:[...messages]});save();addHistory();}
}
function openSettings(){
  $("apiKey").value=currentKey();
  $("systemPrompt").value=localStorage.getItem("gk_system_prompt")||"";
  $("modal").classList.remove("hidden");
}
$("form").addEventListener("submit",e=>{e.preventDefault();const t=$("input").value.trim();$("input").value="";$("input").style.height="auto";send(t)});
$("input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("form").requestSubmit()}});
$("input").addEventListener("input",()=>{$("input").style.height="auto";$("input").style.height=Math.min($("input").scrollHeight,160)+"px"});
$("newChat").onclick=()=>{messages=[];render()};
$("clearBtn").onclick=()=>{messages=[];render()};
$("settingsBtn").onclick=openSettings;
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("saveSettings").onclick=()=>{const k=$("apiKey").value.trim();if(k)localStorage.setItem("gk_api_key",k);localStorage.setItem("gk_system_prompt",$("systemPrompt").value);$("modal").classList.add("hidden")};
$("removeKey").onclick=()=>{localStorage.removeItem("gk_api_key");$("apiKey").value=""};
$("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
document.addEventListener("click",e=>{
  const p=e.target.closest("[data-prompt]");if(p){$("input").value=p.dataset.prompt;$("input").focus()}
  const h=e.target.closest("[data-i]");if(h){messages=JSON.parse(JSON.stringify(conversations[+h.dataset.i].messages));render()}
});
addHistory();render();
