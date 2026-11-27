# FinGuard AI

Three AI agents audit invoices against purchase orders, payments and the vendor list, all at the same time.
Built on [Mozaik](https://mozaik.jigjoy.ai) for the JigJoy hackathon.

**AI reads and explains. Code decides. Every step is checked at a Mozaik breakpoint.**

- **Ledger** reads each invoice PDF and saves its fields.
- **Tally** matches every saved invoice to its purchase order and payments.
- **Sentinel** checks it for duplicates, changed bank details and totals that do not add up.
- Ledger moves on to the next invoice while Tally and Sentinel work, so all three run at once.
- Every amount, match and flag comes from plain, tested rules, never from the model.
- Every finding shows the document, the field, what was expected and what was found.

## Quick start

```bash
cd finguard
pnpm install
pnpm dev
```

Open http://localhost:3000/?audit=sample to run the sample audit straight away.
It runs without any API key in Demo mode; add a free Gemini key to `finguard/.env.local` to use a real model.
Full setup, environment variables and architecture are in [finguard/README.md](finguard/README.md).

## What is in this repo

| Folder | What it is |
| --- | --- |
| [`finguard/`](finguard/) | The app: Next.js, Mozaik agents, rules engine, tests, sample data |
| [`demo-recording/`](demo-recording/) | Scripts that record and render the demo video from the running app |
| [`PLAN.md`](PLAN.md) | The build plan, scope, rules and acceptance tests |
| [`spikes/mozaik/`](spikes/mozaik/) | The early Mozaik 5 spike that proved concurrency before the build |
| [`design/`](design/) | The approved dashboard prototype the app's UI was ported from |

All sample data is synthetic. No real vendors, accounts or client data are included.

## License

[MIT](LICENSE)
