# Hassan Trading Pro — Private Staging

**Staging only. Do not connect this project to the production hostname.**

## Repository layout
- `/index.html` and `/_headers`: static frontend for a separate Cloudflare Pages staging project.
- `/worker/wrangler.toml`, `/worker/src/index.js`, `/worker/schema.sql`: API Worker and D1 schema.

## Worker deploy
Run from the `worker` directory:

```bash
npx wrangler deploy --config wrangler.toml
```

Cloudflare Worker build settings, if using a Git-connected Worker project:
- Root directory: `worker`
- Build command: leave blank
- Deploy command: `npx wrangler deploy --config wrangler.toml`

D1 binding must be `DB`, selecting `hassan-trading-pro-staging`.

## Pages deploy
Create a **separate** Cloudflare Pages project for staging. Set the project root to the repository root and deploy the static files from the root (`index.html`, `_headers`). Do not reuse or edit the production Pages project or its custom domain.

## Security / behavior
- Paper Trading only. MT5/broker execution controls and API calls are disabled in this staging frontend.
- D1 stores user identities, approval state, and sessions. Demo balance, positions, drawings, and trade history remain browser-local in this package; they are not cloud-synchronized.
- Configure `OWNER_EMAIL` and a unique `OWNER_BOOTSTRAP_SECRET` as Worker secrets. Never commit or share the secret.
- After one-time owner bootstrap, remove/disable the bootstrap secret and setup UI before public release.
- Test only on `staging.tradingpro.live`. Production and EBM are out of scope.

## Public chart access (staging build)
- Visitors can open and view the chart without signing in.
- Guests can use chart/timeframe viewing and drawing tools in a guest-local browser workspace.
- Paper Trading, order ticket confirmation, demo balance, and private trade history require an approved login.
- Guest mode hides the demo account panel and blocks order creation in the frontend.
- After login, browser storage is scoped to that user's ID so guest drawings and another user's local data are not reused as that account's data.
- This is frontend access gating; keep the API and any future server-side trade endpoints protected as well.
