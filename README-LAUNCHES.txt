MemeScanner live launches

Files:
- index.html: updated MemeScanner frontend with New / Bonding / Graduated tabs.
- launches-worker.js: Cloudflare Worker backend that detects Pump.fun launches from Solana RPC and reports their bonding/graduated state.

Deployment:
1. Deploy launches-worker.js as a Cloudflare Worker.
2. Copy the Worker URL.
3. In index.html, replace:
   https://YOUR-MEMESCANNER-WORKER.workers.dev/api/launches
   with your real Worker URL + /api/launches
4. Upload index.html to the GitHub Pages repository.
5. The frontend refreshes the launch feed every 15 seconds.

Current adapter:
- Pump.fun on Solana.

Status logic:
- New: launched within the last 2 minutes and still on the curve.
- Bonding: older than 2 minutes and curve not complete.
- Graduated: Pump bonding curve account reports complete=true.

The worker is deliberately structured so additional launchpad adapters can be added next (Raydium LaunchLab, LetsBONK, Bags, Believe, Moonshot, etc.).
