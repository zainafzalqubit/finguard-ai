# FinGuard AI

Three AI agents audit invoices, purchase orders and payments at the same time, built on [Mozaik](https://mozaik.jigjoy.ai).
FinGuard finds duplicate invoices, amounts that do not match the PO, overpayments, unpaid invoices, wrong vendors and changed bank details.
Every finding comes with evidence: the document, the field, what was expected and what was found.

**AI reads and explains, code decides.**
The agents read the documents and choose which checks to run; every amount, match and flag comes from plain, tested code.

## Run it locally

Requirements: Node 24 or newer, pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000, click **New audit**, then **Use sample data**, then **Start audit**.
Or open http://localhost:3000/?audit=sample to start the sample audit straight away.

Without a key it runs in Demo mode: the same agents, goals and tools, driven by a scripted stand-in instead of an AI model, with no network calls.
To use a real model, copy `.env.example` to `.env.local`, add a key, then restart `pnpm dev`.
Every provider with a key appears in the **Model** switch of the New audit dialog, so you can change model per audit.
Defaults are free models:

| Provider | Key | Default model | Notes |
| --- | --- | --- | --- |
| Gemini | `GEMINI_API_KEY` | `gemini-3.5-flash-lite` | Free tier, 15 requests/min; sample audit ~3.5 min |
| OpenRouter | `OPENROUTER_API_KEY` | `baidu/ernie-5.5-flash-preview:free` | ~50 free requests/day without credits |
| Demo mode | none | scripted | Same goals and tools, no AI, no network (`FINGUARD_PROVIDER=offline`) |

Change a model with `GEMINI_MODEL` / `OPENROUTER_MODEL`, and the preselected provider with `FINGUARD_PROVIDER`.
Rate limits are retried automatically (waiting as long as the provider asks); daily caps stop with a clear message,
and an invoice whose checks could not finish is reported as "not fully checked", never as passed.

## How it works

```
Upload (invoice PDFs + CSVs for POs, payments, vendors)
  -> Ingestion: PDF text (unpdf), CSV rows (papaparse + zod)
  -> Mozaik agents, each a Loop driven step by step:
       Ledger   reads each invoice ------------> invoice saved
                                                  |-> Tally     checks PO, vendor and payments
                                                  |-> Sentinel  checks duplicates, bank details, totals
       Ledger moves to the next invoice while Tally and Sentinel work, so all three run at once.
  -> Every tool call stops at a Mozaik breakpoint; FinGuard checks the agent may call that tool
     on that document before it runs.
  -> Rules engine (pure functions) -> findings with evidence
  -> Live dashboard over Server-Sent Events
```

| Agent | Job | Tools |
| --- | --- | --- |
| Ledger | Reads invoices | `saveInvoice` (validated with zod, amounts converted by code) |
| Tally | Matches payments | `checkPayments`, `findUnpaid` |
| Sentinel | Spots risk | `checkRisk` |
| Rules | Exact checks, no AI | The functions behind every tool |

## Checks

| Rule | Severity |
| --- | --- |
| Duplicate invoice (same vendor and number, or same vendor, total and near date) | High |
| Overpayment | High |
| Vendor differs from the PO | High |
| Bank account differs from the vendor list | High |
| Invoice total differs from the PO | Medium |
| Invoice never paid | Medium |
| Subtotal plus tax does not equal total | Medium |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the app |
| `pnpm test` | Runs the 7 acceptance tests and edge cases (no AI involved) |
| `pnpm run audit:cli` | Runs a full audit on the sample files in the terminal |
| `pnpm run samples` | Regenerates the synthetic sample PDFs and CSVs in `data/samples` |
| `pnpm run typecheck` | TypeScript check |
| `pnpm run lint` | ESLint |

## Sample data

`data/samples` holds 9 invoice PDFs and 3 CSVs, all synthetic.
They cover every acceptance test, plus 3 clean invoices that must pass with no findings.
Your own files work too: CSV names must include `po`/`purchase`, `payments` or `vendors`, with these columns:

- Purchase orders: `po_number, vendor_id, amount, currency`
- Payments: `payment_id, invoice_number, vendor_id, amount, paid_on`
- Vendors: `vendor_id, name, bank_account`

## Project layout

```
src/domain     shared types, money, agents, file kinds, events
src/ingest     PDF and CSV reading, invoice field validation
src/rules      the checks, one pure function each
src/agents     Mozaik module, loop driver with breakpoint policy, tools, offline model
src/audit      run pipeline, shared audit state, run event store
src/app/api    upload, live events (SSE), sample list
src/ui         dashboard components and styles
tests          acceptance tests
```

