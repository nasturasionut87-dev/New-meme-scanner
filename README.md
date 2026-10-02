# MemeScanner.FUN — Stage 1

Stage 1 adds the first **live launch detectors** while keeping the existing GitHub Pages frontend.

## Live sources

### Pump.fun — Solana
- Watches the official Pump program on Solana.
- Detects the on-chain `create` / `createV2` launch event.
- Reads the token name, symbol, mint, creator and bonding curve from the event.
- Reads the bonding-curve account to classify **New / Bonding / Graduated**.
- Uses the official Pump program ID documented by Pump.

### PONS V2 — Robinhood Chain
- Watches the verified PONS V2 factory.
- Detects `TokenLaunched` and `PoolGraduated`.
- Reads ERC-20 name/symbol directly from the token contract.
- Uses Robinhood Chain RPC and verified PONS factory/event addresses.

## Files

- `index.html` — frontend
- `styles.css` — frontend styling
- `app.js` — frontend logic
- `worker.js` — Stage 1 live API/scanner
- `wrangler.toml` — Cloudflare Worker deployment config
- `.github/workflows/deploy-worker.yml` — deploy Worker automatically from GitHub

## GitHub + Cloudflare deployment

The website can stay on GitHub Pages. The API runs on the existing `sionut87.workers.dev` Worker.

To deploy the Worker from GitHub without editing Cloudflare code manually, add these GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Then every push to `main` deploys `worker.js` automatically.

The frontend already points to:

`https://sionut87.workers.dev/api/launches`

## Optional environment variables

Cloudflare Worker variables can override the public RPCs and scanner limits:

- `SOLANA_RPC_URL`
- `ROBINHOOD_RPC_URL`
- `PUMP_TX_LIMIT`
- `PONS_LOOKBACK_BLOCKS`

Public RPCs are suitable for Stage 1 testing but should eventually be replaced with dedicated RPC capacity for production reliability.

## Stage plan

### Stage 1 — Live detection
- Pump.fun detector
- PONS detector
- New / Bonding / Graduated classification
- CA, creator, transaction and launchpad data

### Stage 2 — Enrichment
- SOL/ETH prices
- Market cap
- Liquidity
- Volume
- Images/socials
- Accurate bonding percentage for both launchpads

### Stage 3 — Live stream
- Persistent state
- WebSocket/SSE or durable event cursor
- Faster updates without rescanning large windows

### Stage 4 — More launchpads
- Raydium LaunchLab
- LetsBONK
- Bags
- Believe
- Moonshot

### Stage 5 — More chains
- Base
- BNB Chain
- TRON
- Additional EVM launchpads

## Safety

The scanner is read-only. It does not hold private keys and does not sign or submit trades. Buy buttons continue to open the relevant external trading pages.
