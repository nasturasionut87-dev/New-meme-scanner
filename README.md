# MemeScanner — New Repository

A fresh rebuild of MemeScanner.FUN focused on live memecoin discovery.

## Frontend
- `index.html`
- `styles.css`
- `app.js`

The frontend has three core states:
- New
- Bonding
- Graduated

It refreshes the launch API every 15 seconds.

## Backend
- `worker.js`

Deploy `worker.js` as a Cloudflare Worker. Then replace the API URL in `app.js`:

`https://YOUR-MEMESCANNER-WORKER.workers.dev/api/launches`

The Worker is intentionally provider-neutral. Set `LAUNCH_INDEXER_URL` to a trusted launch-indexer endpoint returning:

```json
{
  "items": [
    {
      "name": "Example",
      "symbol": "EX",
      "launchpad": "Pump.fun",
      "chain": "Solana",
      "status": "new",
      "createdAt": "2026-10-02T09:00:00Z",
      "marketCap": 12000,
      "liquidity": 6000,
      "volume24h": 25000,
      "bondingProgress": 22,
      "address": "TOKEN_ADDRESS"
    }
  ]
}
```

## Roadmap
1. Pump.fun live adapter
2. Raydium LaunchLab adapter
3. LetsBONK adapter
4. Bags / Believe / Moonshot adapters
5. Base / BNB / TRON adapters
6. Search/detail pages
7. WebSocket/SSE live updates

Keep API keys and RPC credentials in Worker secrets, never in the frontend.

Pump.fun currently supports coin launches on Solana and has a documented graduation path to PumpSwap; its current documentation also lists SOL and USDC as launch pair assets. Verify protocol details when implementing each adapter.
