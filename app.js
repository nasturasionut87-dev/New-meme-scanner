const API = window.MEMESCANNER_API || "https://YOUR-MEMESCANNER-WORKER.workers.dev/api/launches";
let state = { items: [], filter: "all", query: "" };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money = (n) => {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return "$"+(n/1e9).toFixed(2)+"B";
  if (n >= 1e6) return "$"+(n/1e6).toFixed(2)+"M";
  if (n >= 1e3) return "$"+(n/1e3).toFixed(1)+"K";
  return "$"+n.toFixed(n < 1 ? 4 : 0);
};
const age = (ts) => {
  const s = Math.max(0, Math.floor((Date.now()-new Date(ts).getTime())/1000));
  if(s<60) return s+"s ago"; if(s<3600) return Math.floor(s/60)+"m ago"; if(s<86400) return Math.floor(s/3600)+"h ago"; return Math.floor(s/86400)+"d ago";
};
const short = (s) => s ? String(s).slice(0,5)+"…"+String(s).slice(-4) : "—";

function render() {
  const q = state.query.toLowerCase();
  const items = state.items.filter(x =>
    (state.filter === "all" || x.status === state.filter) &&
    (!q || `${x.name} ${x.symbol} ${x.address} ${x.launchpad}`.toLowerCase().includes(q))
  );
  $("cards").innerHTML = items.length ? items.map(card).join("") :
    `<div class="empty">No launches match your filter.</div>`;
  $("newCount").textContent = state.items.filter(x=>x.status==="new").length;
  $("bondCount").textContent = state.items.filter(x=>x.status==="bonding").length;
  $("gradCount").textContent = state.items.filter(x=>x.status==="graduated").length;
  $("updated").textContent = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}

function card(x) {
  const pct = Math.max(0, Math.min(100, Number(x.bondingProgress || 0)));
  const statusLabel = x.status === "new" ? "NEW" : x.status === "bonding" ? "BONDING" : "GRADUATED";
  const explorer = x.chain === "solana" ? `https://solscan.io/token/${encodeURIComponent(x.address)}` : "#";
  const launch = x.launchUrl || "#";
  return `<article class="card">
    <div class="card-top">
      <div class="token">
        <div class="avatar">${x.image ? `<img src="${esc(x.image)}" alt="">` : esc((x.symbol||"?").slice(0,3))}</div>
        <div><b>${esc(x.name || "Unknown")}</b><small>$${esc(x.symbol || "—")} · ${esc(x.launchpad || "Unknown")}</small></div>
      </div>
      <span class="badge ${esc(x.status)}">${statusLabel}</span>
    </div>
    <div class="metrics">
      <div class="metric"><span>Market cap</span><b>${money(x.marketCap)}</b></div>
      <div class="metric"><span>Liquidity</span><b>${money(x.liquidity)}</b></div>
      <div class="metric"><span>Volume</span><b>${money(x.volume24h)}</b></div>
    </div>
    ${x.status === "bonding" ? `<div class="progress"><div class="progress-head"><span>Bonding curve</span><b>${pct.toFixed(0)}%</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>` : ""}
    <div class="card-bottom"><span>${age(x.createdAt)} · ${esc(x.chain || "Solana")}</span><div class="links"><a href="${esc(explorer)}" target="_blank" rel="noreferrer">Explorer ↗</a>${launch !== "#" ? `<a href="${esc(launch)}" target="_blank" rel="noreferrer">Launch ↗</a>` : ""}</div></div>
  </article>`;
}

async function load() {
  try {
    const r = await fetch(API, {headers:{accept:"application/json"}});
    if (!r.ok) throw new Error("HTTP "+r.status);
    const d = await r.json();
    state.items = Array.isArray(d.items) ? d.items : [];
    $("source").textContent = d.source ? `Source: ${d.source}` : "Live scanner";
    render();
  } catch(e) {
    $("source").textContent = "Scanner offline — showing demo structure";
    state.items = demoData();
    render();
  }
}

function demoData(){
  const now = Date.now();
  return [
    {name:"Paper Dog",symbol:"PAPER",launchpad:"Pump.fun",chain:"Solana",status:"new",createdAt:new Date(now-22000).toISOString(),marketCap:8200,liquidity:4100,volume24h:12800,address:"DemoAddressPaper"},
    {name:"Moon Cat",symbol:"MOONCAT",launchpad:"Pump.fun",chain:"Solana",status:"bonding",createdAt:new Date(now-260000).toISOString(),marketCap:31200,liquidity:15600,volume24h:68400,bondingProgress:62,address:"DemoAddressMoon"},
    {name:"Bonk Ape",symbol:"BAPE",launchpad:"LetsBONK",chain:"Solana",status:"bonding",createdAt:new Date(now-720000).toISOString(),marketCap:18400,liquidity:9200,volume24h:41700,bondingProgress:38,address:"DemoAddressApe"},
    {name:"Graduated Dog",symbol:"GDOG",launchpad:"Pump.fun",chain:"Solana",status:"graduated",createdAt:new Date(now-3600000).toISOString(),marketCap:184000,liquidity:92000,volume24h:531000,address:"DemoAddressDog"}
  ];
}

document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); state.filter=b.dataset.filter; render();
}));
$("refresh").addEventListener("click", load);
$("searchBtn").addEventListener("click", ()=>{state.query=$("search").value.trim();render()});
$("search").addEventListener("keydown",e=>{if(e.key==="Enter"){state.query=e.target.value.trim();render()}});

load();
setInterval(load, 15000);
