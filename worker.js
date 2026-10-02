// MemeScanner launch API
// Cloudflare Worker. The frontend calls GET /api/launches.
// This version is deliberately provider-neutral: plug a launchpad/indexer
// into the adapter below instead of exposing RPC/API keys in the browser.

const DEMO = [
  {name:"Paper Dog",symbol:"PAPER",launchpad:"Pump.fun",chain:"Solana",status:"new",createdAt:new Date(Date.now()-22000).toISOString(),marketCap:8200,liquidity:4100,volume24h:12800,bondingProgress:0,address:"DemoAddressPaper"},
  {name:"Moon Cat",symbol:"MOONCAT",launchpad:"Pump.fun",chain:"Solana",status:"bonding",createdAt:new Date(Date.now()-260000).toISOString(),marketCap:31200,liquidity:15600,volume24h:68400,bondingProgress:62,address:"DemoAddressMoon"},
  {name:"Bonk Ape",symbol:"BAPE",launchpad:"LetsBONK",chain:"Solana",status:"bonding",createdAt:new Date(Date.now()-720000).toISOString(),marketCap:18400,liquidity:9200,volume24h:41700,bondingProgress:38,address:"DemoAddressApe"},
  {name:"Graduated Dog",symbol:"GDOG",launchpad:"Pump.fun",chain:"Solana",status:"graduated",createdAt:new Date(Date.now()-3600000).toISOString(),marketCap:184000,liquidity:92000,volume24h:531000,bondingProgress:100,address:"DemoAddressDog"}
];

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,headers:{
      "content-type":"application/json; charset=UTF-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ok:true});
    if (url.pathname === "/api/launches") {
      // Replace getLaunches() with the real provider/indexer adapter.
      const items = await getLaunches(env);
      return json({source: items === DEMO ? "demo" : "live", updatedAt:new Date().toISOString(), items});
    }
    return new Response("MemeScanner API",{status:200,headers:{"content-type":"text/plain"}});
  }
};

async function getLaunches(env){
  // A live provider can be configured without changing the frontend.
  // Example: set LAUNCH_INDEXER_URL to your own indexed endpoint.
  if(env.LAUNCH_INDEXER_URL){
    try{
      const r = await fetch(env.LAUNCH_INDEXER_URL,{headers:{accept:"application/json"}});
      if(r.ok){
        const d = await r.json();
        if(Array.isArray(d.items)) return d.items;
      }
    }catch(_){}
  }
  return DEMO;
}
