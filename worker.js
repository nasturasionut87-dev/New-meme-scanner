// MemeScanner.FUN — Stage 1 live launch detector
// Sources: Pump.fun on Solana + PONS V2 on Robinhood Chain.
// Read-only: this worker never signs or submits transactions.

const DEMO = [
  {name:"Paper Dog",symbol:"PAPER",launchpad:"Pump.fun",chain:"Solana",status:"new",createdAt:new Date(Date.now()-22000).toISOString(),marketCap:8200,liquidity:4100,volume24h:12800,bondingProgress:0,address:"DemoAddressPaper"},
  {name:"Moon Cat",symbol:"MOONCAT",launchpad:"Pump.fun",chain:"Solana",status:"bonding",createdAt:new Date(Date.now()-260000).toISOString(),marketCap:31200,liquidity:15600,volume24h:68400,bondingProgress:62,address:"DemoAddressMoon"},
  {name:"PONS Demo",symbol:"PONS",launchpad:"PONS",chain:"Robinhood Chain",status:"bonding",createdAt:new Date(Date.now()-360000).toISOString(),marketCap:null,liquidity:null,volume24h:null,bondingProgress:12,address:"0x0000000000000000000000000000000000000000"}
];

const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMP_CREATE_EVENT = [27,114,169,77,222,235,99,118];
const PUMP_CURVE_ACCOUNT_DISCRIMINATOR = [23,183,248,55,96,216,172,96];
const SOLANA_RPC_DEFAULT = "https://api.mainnet-beta.solana.com";

const PONS_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_TOKEN_LAUNCHED = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const PONS_POOL_GRADUATED = "0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259";
const ROBINHOOD_RPC_DEFAULT = "https://rpc.mainnet.chain.robinhood.com/";
const ERC20_NAME = "0x06fdde03";
const ERC20_SYMBOL = "0x95d89b41";

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=UTF-8",
    "cache-control":"no-store",
    "access-control-allow-origin":"*"
  }});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ok:true});
    if (url.pathname === "/health") return json({ok:true,service:"memescanner-stage1",sources:["Pump.fun","PONS"],time:new Date().toISOString()});
    if (url.pathname === "/api/launches") {
      const result = await scanAll(env || {});
      return json(result);
    }
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("MemeScanner Stage 1",{status:200,headers:{"content-type":"text/plain"}});
  }
};

async function scanAll(env){
  const [pump, pons] = await Promise.allSettled([scanPump(env), scanPons(env)]);
  const items = [];
  const errors = [];
  if (pump.status === "fulfilled") items.push(...pump.value.items);
  else errors.push("pump:" + String(pump.reason?.message || pump.reason));
  if (pons.status === "fulfilled") items.push(...pons.value.items);
  else errors.push("pons:" + String(pons.reason?.message || pons.reason));

  const dedup = new Map();
  for (const item of items) {
    const key = `${item.chain}:${String(item.address).toLowerCase()}`;
    if (!dedup.has(key) || new Date(item.createdAt) > new Date(dedup.get(key).createdAt)) dedup.set(key,item);
  }
  const merged = [...dedup.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,100);

  return {
    source: merged.length ? "live" : "demo",
    stage: 1,
    updatedAt: new Date().toISOString(),
    sources: {pumpFun: pump.status === "fulfilled", pons: pons.status === "fulfilled"},
    errors,
    items: merged.length ? merged : DEMO
  };
}

async function scanPump(env){
  const rpc = env.SOLANA_RPC_URL || SOLANA_RPC_DEFAULT;
  const sigs = await solana(rpc,"getSignaturesForAddress",[PUMP_PROGRAM,{limit:Number(env.PUMP_TX_LIMIT||80)}]);
  const recent = (sigs || []).filter(x=>!x.err).slice(0,Number(env.PUMP_TX_LIMIT||80));
  if (!recent.length) return {items:[]};

  const batch = recent.map((s,i)=>({jsonrpc:"2.0",id:i+1,method:"getTransaction",params:[s.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:0}]}));
  const txs = await solanaBatch(rpc,batch);
  const launches = [];

  for (let i=0;i<txs.length;i++) {
    const tx = txs[i];
    const logs = tx?.result?.meta?.logMessages || [];
    const create = logs.some(line=>line.includes("Instruction: Create") || line.includes("Instruction: CreateV2"));
    if (!create) continue;

    const event = (logs.filter(line=>line.startsWith("Program data: ")).map(x=>x.slice("Program data: ".length)).map(decodePumpCreateEvent).find(Boolean));
    if (!event) continue;
    const blockTime = tx.result.blockTime ? tx.result.blockTime*1000 : Date.now();
    const curve = event.bondingCurve;
    let status = "new";
    let progress = 0;
    if (curve) {
      try {
        const acc = await solana(rpc,"getAccountInfo",[curve,{encoding:"base64"}]);
        const state = parsePumpCurve(acc?.value?.data?.[0]);
        if (state) {
          status = state.complete ? "graduated" : "bonding";
          progress = state.complete ? 100 : pumpProgress(state);
        }
      } catch (_) {}
    }

    launches.push({
      name:event.name,
      symbol:event.symbol,
      launchpad:"Pump.fun",
      chain:"Solana",
      status,
      createdAt:new Date(blockTime).toISOString(),
      marketCap:null,
      liquidity:null,
      volume24h:null,
      bondingProgress:progress,
      address:event.mint,
      creator:event.creator,
      txHash:recent[i]?.signature || null,
      launchUrl:`https://pump.fun/coin/${encodeURIComponent(event.mint)}`
    });
  }
  return {items:uniqueNewest(launches)};
}

function decodePumpCreateEvent(b64){
  try {
    const bytes = Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    if (bytes.length < 8 || !sameBytes(bytes.slice(0,8),PUMP_CREATE_EVENT)) return null;
    let o=8;
    const a=readString(bytes,o); if(!a) return null; o=a.next;
    const b=readString(bytes,o); if(!b) return null; o=b.next;
    const c=readString(bytes,o); if(!c) return null; o=c.next;
    const mint=base58(bytes.slice(o,o+32)); o+=32;
    const bondingCurve=base58(bytes.slice(o,o+32)); o+=32;
    const user=base58(bytes.slice(o,o+32)); o+=32;
    const creator=base58(bytes.slice(o,o+32)); o+=32;
    if(o+8>bytes.length) return null;
    const timestamp=readI64LE(bytes,o); o+=8;
    return {name:a.value,symbol:b.value,uri:c.value,mint,bondingCurve,user,creator,timestamp};
  } catch (_) { return null; }
}

function parsePumpCurve(b64){
  try {
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    if(bytes.length < 8+8*5+1) return null;
    if(!sameBytes(bytes.slice(0,8),PUMP_CURVE_ACCOUNT_DISCRIMINATOR)) return null;
    let o=8;
    const virtualToken=readU64LE(bytes,o);o+=8;
    const virtualQuote=readU64LE(bytes,o);o+=8;
    const realToken=readU64LE(bytes,o);o+=8;
    const realQuote=readU64LE(bytes,o);o+=8;
    const totalSupply=readU64LE(bytes,o);o+=8;
    const complete=bytes[o]!==0;
    return {virtualToken,virtualQuote,realToken,realQuote,totalSupply,complete};
  } catch (_) { return null; }
}

function pumpProgress(s){
  // Pump's curve state exposes real token reserves. Depletion of the initial
  // real-token reserve is a useful on-chain progress approximation.
  const initialReal = 793100000000000n;
  const real = BigInt(s.realToken);
  if(real <= 0n) return 100;
  const p = Number((initialReal-real)*100000n/initialReal)/1000;
  return Math.max(0,Math.min(99.9,p));
}

async function scanPons(env){
  const rpc=env.ROBINHOOD_RPC_URL || ROBINHOOD_RPC_DEFAULT;
  const latestHex=await evm(rpc,"eth_blockNumber",[]);
  const latest=parseInt(latestHex,16);
  const lookback=Math.min(Number(env.PONS_LOOKBACK_BLOCKS||3000),10000);
  const from=Math.max(0,latest-lookback);
  const [launchLogs,gradLogs]=await Promise.all([
    getLogsChunked(rpc,PONS_FACTORY,PONS_TOKEN_LAUNCHED,from,latest),
    getLogsChunked(rpc,PONS_FACTORY,PONS_POOL_GRADUATED,from,latest)
  ]);

  const graduated=new Set();
  for(const log of gradLogs) if(log.topics?.[1]) graduated.add(topicAddress(log.topics[1]));

  const launches=launchLogs.map(parsePonsLaunch).filter(Boolean);
  const tokens=uniqueNewest(launches);
  const meta=await ponsMetadata(rpc,tokens.map(x=>x.address));
  for(const x of tokens){
    const m=meta.get(x.address.toLowerCase());
    if(m?.name) x.name=m.name;
    if(m?.symbol) x.symbol=m.symbol;
    if(graduated.has(x.address.toLowerCase())) {x.status="graduated";x.bondingProgress=100;}
    else {x.status="bonding";x.bondingProgress=0;}
  }
  return {items:tokens};
}

async function getLogsChunked(rpc,address,topic,from,to){
  const out=[];
  const chunk=Number(500);
  for(let a=from;a<=to;a+=chunk){
    const b=Math.min(to,a+chunk-1);
    try{
      const logs=await evm(rpc,"eth_getLogs",[{address,fromBlock:"0x"+a.toString(16),toBlock:"0x"+b.toString(16),topics:[topic]}]);
      if(Array.isArray(logs)) out.push(...logs);
    }catch(_){ }
  }
  return out;
}

function parsePonsLaunch(log){
  if(!log?.topics?.[1]) return null;
  const token=topicAddress(log.topics[1]);
  const deployer=log.topics?.[3] ? topicAddress(log.topics[3]) : null;
  const data=(log.data||"").replace(/^0x/,"").padEnd(192,"0");
  const threshold=BigInt("0x"+data.slice(128,192));
  return {
    name:"Loading…",
    symbol:"PONS",
    launchpad:"PONS",
    chain:"Robinhood Chain",
    status:"bonding",
    createdAt:new Date().toISOString(),
    marketCap:null,
    liquidity:null,
    volume24h:null,
    bondingProgress:0,
    address:token,
    creator:deployer,
    txHash:log.transactionHash,
    blockNumber:parseInt(log.blockNumber,16),
    graduationThreshold:threshold.toString(),
    launchUrl:`https://ponsfamily.com/token/${token}`
  };
}

async function ponsMetadata(rpc,addresses){
  const map=new Map();
  const calls=[];
  let id=1;
  for(const address of addresses){
    const a=address.slice(2).padStart(64,"0");
    calls.push({jsonrpc:"2.0",id:id++,method:"eth_call",params:[{to:address,data:ERC20_NAME+ a},"latest"]});
    calls.push({jsonrpc:"2.0",id:id++,method:"eth_call",params:[{to:address,data:ERC20_SYMBOL+ a},"latest"]});
  }
  // name/symbol are zero-argument functions; the padded address above is not
  // part of the call. Correct the calldata before sending.
  for(const c of calls) c.params[0].data=c.params[0].data.slice(0,10);
  const results=await evmBatch(rpc,calls);
  for(let i=0;i<addresses.length;i++){
    const name=decodeAbiString(results[i*2]?.result);
    const symbol=decodeAbiString(results[i*2+1]?.result);
    map.set(addresses[i].toLowerCase(),{name,symbol});
  }
  return map;
}

function decodeAbiString(hex){
  if(!hex || hex==="0x") return null;
  try{
    const h=hex.slice(2);
    let offset=parseInt(h.slice(0,64),16);
    if(offset+64>h.length) return null;
    const len=parseInt(h.slice(offset,offset+64),16);
    const raw=h.slice(offset+64,offset+64+len*2);
    return new TextDecoder().decode(Uint8Array.from(raw.match(/../g)||[],x=>parseInt(x,16))).replace(/\u0000/g,"").trim();
  }catch(_){return null;}
}

async function solana(rpc,method,params){
  const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if(!r.ok) throw new Error(`Solana RPC ${r.status}`);
  const d=await r.json();
  if(d.error) throw new Error(d.error.message||"Solana RPC error");
  return d.result;
}
async function solanaBatch(rpc,requests){
  const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(requests)});
  if(!r.ok) throw new Error(`Solana RPC ${r.status}`);
  const d=await r.json();
  return requests.map(q=>d.find(x=>x.id===q.id)||null);
}
async function evm(rpc,method,params){
  const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if(!r.ok) throw new Error(`EVM RPC ${r.status}`);
  const d=await r.json();
  if(d.error) throw new Error(d.error.message||"EVM RPC error");
  return d.result;
}
async function evmBatch(rpc,requests){
  const r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(requests)});
  if(!r.ok) throw new Error(`EVM RPC ${r.status}`);
  const d=await r.json();
  return requests.map(q=>d.find(x=>x.id===q.id)||{});
}

function readString(bytes,o){
  if(o+4>bytes.length) return null;
  const len=readU32LE(bytes,o);o+=4;
  if(o+len>bytes.length) return null;
  return {value:new TextDecoder().decode(bytes.slice(o,o+len)),next:o+len};
}
function readU32LE(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function readU64LE(b,o){let n=0n;for(let i=7;i>=0;i--)n=(n<<8n)+BigInt(b[o+i]);return n;}
function readI64LE(b,o){let n=readU64LE(b,o);return n>0x7fffffffffffffffn?n-0x10000000000000000n:n;}
function sameBytes(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function base58(bytes){const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";let digits=[0];for(const byte of bytes){let carry=byte;for(let j=0;j<digits.length;j++){const v=digits[j]*256+carry;digits[j]=v%58;carry=Math.floor(v/58);}while(carry){digits.push(carry%58);carry=Math.floor(carry/58);}}let out="";for(const byte of bytes){if(byte!==0)break;out+="1";}for(let i=digits.length-1;i>=0;i--)out+=alphabet[digits[i]];return out;}
function topicAddress(topic){return "0x"+topic.slice(-40).toLowerCase();}
function uniqueNewest(items){const m=new Map();for(const x of items){const k=String(x.address).toLowerCase();if(!m.has(k)||new Date(x.createdAt)>new Date(m.get(k).createdAt))m.set(k,x);}return [...m.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}
