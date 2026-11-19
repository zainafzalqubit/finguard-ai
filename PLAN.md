# FinGuard AI - Local Execution Plan

Autonomous multi-agent financial audit system built on Mozaik.
It finds invoice fraud, payment discrepancies and duplicate transactions, and backs every finding with evidence.

- Prep window: 19-25 Nov 2026 (learning, setup, design; no substantive build code until the rules allow it)
- Build window: 26-27 Nov 2026
- Target submission: 27 Nov, 10 PM PKT
- Hard deadline: 28 Nov, 4 AM PKT

Status on 19 Nov: dashboard design approved, logo and favicon done, Mozaik spike working (see section 2).

---

## 0. Key decisions

1. **Event-driven pipeline, not three isolated agents.**
   Tally and Sentinel need extracted invoices, so they cannot be fully independent.
   Ledger emits `invoice.extracted` per document, and Tally and Sentinel start on invoice #1 while Ledger reads invoice #2.
   The spike already shows 3 of 3 agents working at the same moment.
2. **AI explains, code decides.**
   Agents call deterministic tools (`matchPayments`, `findDuplicates`, `checkBankDetails` ...).
   The model only reads PDFs and writes the plain-language explanation.
   No amount, match or flag ever comes from the model's own maths.
3. **No proof, no finding.**
   A finding is only stored if it carries the rule id and at least one evidence row (`documentId`, `field`, `expected`, `found`).
   The state object rejects findings without evidence.
4. **Every tool call passes a breakpoint check.**
   Mozaik 5 stops before each tool call; our policy checks that the agent may call that tool before it runs.
   This is also the audit trail: every step the agents took is recorded.
5. **One Next.js app.**
   Route handlers host the agents, Server-Sent Events stream activity to the dashboard.
6. **`node:sqlite`** (built into Node), no native build step on Windows.
   Fallback: in-memory store plus a JSON dump.
7. **Agent module is a singleton.**
   `initAgentModule` throws if called twice, and Next.js hot reload re-runs modules, so guard it on `globalThis`.
8. **Vendor master file** is required for the bank-change check.

---

## 1. Scope

| Feature | Priority | Notes |
| --- | --- | --- |
| Upload PDF invoices + CSV POs, payments, vendors | Must | Upload dialog already designed |
| Invoice field extraction | Must | Model with structured output, validated with zod |
| 3 concurrent Mozaik agents | Must | Ledger, Tally, Sentinel |
| Invoice / PO / payment matching | Must | Deterministic |
| Duplicate detection | Must | Exact + same vendor/total/date |
| Fraud / risk flags | Must | Bank change, vendor mismatch |
| Evidence-based findings | Must | Expected vs found per field |
| Live agent dashboard | Must | SSE event stream |
| Load sample data button | Must | Makes the demo reliable |
| Unusual amount rule | Should | Drop first if time is short |
| Export report | Optional | Printable HTML only if time is left |

Out of scope: auth, multi-tenant, OCR of scanned images, queues, vector DBs, cloud deploy.

---

## 2. Mozaik: what is actually in the package

Verified on 19 Nov by installing and reading the package source (`spikes/mozaik`).

- `@mozaik-ai/core@5.0.1` (latest, released 15 Nov) is a rewrite: an **interruptible single-agent harness** built on Loops and breakpoints.
- The docs site (docs.jigjoy.ai) still describes **4.2.0** (29 Oct): `defineRuntime`, `RuntimeState`, events, `runLoop`. None of that is in 5.x.
- 5.x API: `initAgentModule`, `resolveAgentModule` returning `createAgent`, `registerTool`, `createLoop`, `setBreakpoint`, `advanceLoop`, `getLoop`, `endLoop`.
- The app drives each Loop one step at a time: set an inference breakpoint, advance, read the result, set a tool-call breakpoint for each tool call, advance, feed the result back.
- Concurrency, shared state and events are built by us on top (done in the spike, about 150 lines).
- Custom models plug in through `inferenceRunnerConfig.supportedModels`; the spike uses this for an offline mock model.
- The agent's `instruction` is not sent automatically; the driver adds it as a `system_message`.
- Bundled model names include `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-sonnet-5-5`, `gpt-5.4-mini`, `gemini-3.5-flash`.
- Keys come from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`.

**Open decision: which Mozaik version.**
Check the hackathon brief for a required version or required features.

| | 5.0.1 (recommended) | 4.2.0 |
| --- | --- | --- |
| Status | Latest, what JigJoy is promoting now | Older, matches the docs site |
| Multi-agent | Built by us on top of Loops | Built in (`defineRuntime`, events) |
| Our pitch | Breakpoints = every tool call checked and recorded, fits "code decides" | Built-in events and shared state |
| Risk | Very new, fewer examples | Judges may see it as outdated |

Recommendation: 5.0.1, unless the brief asks for the runtime features of 4.2.

---

## 3. Architecture

```
Upload (PDF, CSV)
   |
   v
Ingestion (deterministic): papaparse + zod for CSV, unpdf for PDF text
   |
   v
Agent layer (Mozaik 5 Loops, driven by our runAgent())
   Ledger   reads each invoice ------ invoice.extracted ------> Tally     matches PO + payments
                                                         \----> Sentinel  duplicates, bank, vendor
   Every tool call stops at a breakpoint, passes the policy check, then runs deterministic code.
   |
   v
Shared AuditState (one per run) + typed event bus -> SQLite + SSE
   |
   v
Rules engine (pure functions, unit tested) -> findings with evidence
   |
   v
Dashboard
```

### Agents

| Agent | Job | Tools (deterministic) | Emits |
| --- | --- | --- | --- |
| Ledger | Reads invoices | `extractInvoice` (model reads PDF text with structured output, code validates) | `invoice.extracted` |
| Tally | Matches payments | `matchPayments`, `findUnpaid` | findings |
| Sentinel | Spots risk | `findDuplicates`, `checkBankDetails`, `checkVendor` | findings |
| Rules | Exact checks, no AI | the functions behind every tool | step events |

`findUnpaid` runs once after all invoices are read, because it needs every payment in view.

---

## 4. Data model

All amounts are integer cents.
Currency is a field, never assumed.

```ts
interface Invoice { invoiceNumber; vendorId; poNumber; issueDate; subtotalCents; taxCents; totalCents; currency; bankAccount; sourceFile }
interface PurchaseOrder { poNumber; vendorId; amountCents; currency }
interface Payment { paymentId; invoiceNumber; vendorId; amountCents; paidOn; bankAccount }
interface Vendor { vendorId; name; bankAccount }
interface Finding { ruleId; severity; invoiceNumber; raisedBy; title; explanation; evidence: Evidence[] }
interface Evidence { documentId; field; expected; found }
```

---

## 5. Rules

| Rule id | Check | Severity |
| --- | --- | --- |
| `DUPLICATE_INVOICE` | Same vendor + number, or same vendor + total + date within 3 days | high |
| `PO_AMOUNT_MISMATCH` | Invoice total differs from PO amount (tolerance 0) | medium |
| `OVERPAYMENT` | Payments for an invoice exceed its total | high |
| `UNPAID_INVOICE` | No payment found | medium |
| `VENDOR_MISMATCH` | Invoice vendor differs from PO vendor | high |
| `BANK_DETAILS_CHANGED` | Bank account differs from vendor master | high |
| `INVOICE_TOTALS_INVALID` | subtotal + tax does not equal total | medium |

Thresholds live in one `rules.config.ts`.

---

## 6. Acceptance tests (synthetic data only)

| # | Input | Expected |
| --- | --- | --- |
| 1 | INV-1001 uploaded twice | `DUPLICATE_INVOICE` |
| 2 | Invoice $5,000, PO $4,000 | `PO_AMOUNT_MISMATCH` |
| 3 | Payment $6,000 on a $5,000 invoice | `OVERPAYMENT` |
| 4 | Invoice vendor differs from PO vendor | `VENDOR_MISMATCH` |
| 5 | Invoice with no payment | `UNPAID_INVOICE` |
| 6 | Bank account differs from vendor list | `BANK_DETAILS_CHANGED` |
| 7 | Everything matches | no findings |

Each test: a vitest unit test on the rules engine (no model), plus one end-to-end run on the sample data.
Tests 3 and 6 already pass in the spike.

---

## 7. Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node 26 (installed), native TypeScript type stripping for scripts |
| App | Next.js 16 (App Router), TypeScript strict |
| Agents | `@mozaik-ai/core`, pinned (5.0.1 unless decided otherwise) |
| Models | `claude-haiku-4-5` for tool use and explanations, `claude-sonnet-4-6` for PDF extraction if Haiku misreads |
| Validation | zod |
| CSV / PDF | papaparse / unpdf; pdf-lib to generate the sample PDFs |
| DB | `node:sqlite` |
| Live updates | Server-Sent Events |
| Tests | vitest |
| Package manager | pnpm |

---

## 8. Folder structure

```
finguard/
  app/                      page, runs/[runId], api/runs (upload), api/runs/[runId]/events (SSE)
  src/domain/               types, money helpers, rule ids
  src/ingest/               csv.ts, pdf.ts, normalize.ts
  src/rules/                one file per rule + index.ts
  src/agents/               module.ts (singleton), run-agent.ts, ledger.ts, tally.ts, sentinel.ts, tools/
  src/state/                audit-state.ts, event bus
  src/db/                   sqlite.ts, repositories
  src/ui/                   tokens.css + components ported from design/dashboard.html
  data/samples/             synthetic PDFs + CSVs
  scripts/generate-samples.ts
  tests/
  DESIGN.md
  README.md
```

`spikes/` and `design/` stay out of the submission; approved pieces move into `finguard/`, they are not copied.

---

## 9. UI (approved 19 Nov)

Reference: `design/dashboard.html` (open with `#end` for the finished run, `#upload` for the dialog).
Brand: `design/logo.svg`, `design/favicon.svg`.

- Layout: left icon bar, sidebar card (documents + agents), centre timeline, findings card on the right, control dock at the bottom.
- Timeline: one row per agent; overlapping bars show the agents working at the same time.
- Findings: severity filter with counts, expandable evidence (expected vs found), Mark reviewed, passed-invoices summary.
- Upload dialog: drop zone, checklist of the 4 required file types, file list, sample data.
- Style: pure neutral dark gray, borderless, light embossed controls, compact, inset rounded cards, Manrope, Hugeicons.
- Port the `:root` tokens into `src/ui/tokens.css` and `DESIGN.md`; do not change the look while porting.

---

## 10. Timeline

### Prep

| Date | Focus | Status |
| --- | --- | --- |
| Wed 19 | Mozaik deep dive + concurrency spike | Done: spike runs, 3 of 3 agents overlap |
| Wed 19 | Dashboard, upload dialog, logo, favicon | Done |
| Thu 20 | Run the spike with a real model (`claude-haiku-4-5`); decide 5.0.1 vs 4.2.0 | Next |
| Fri 21 | Sample data covering all 7 tests; sample generator plan | |
| Sat 22 | PDF text extraction test (unpdf) + structured output for one invoice | |
| Sun 23 | DESIGN.md + tokens.css from the approved design | |
| Mon 24 | Freeze architecture, event names, expected findings per test | |
| Tue 25 | Registration, rules, API key and billing, empty repo | |

### Build day 1 - Wed 26 Nov (engine)

| Block | Task | Done when |
| --- | --- | --- |
| 09-11 | Scaffold Next.js, domain types, sample generator | typecheck passes, samples generated |
| 11-13 | Ingestion: CSV + PDF + normalize | All samples parse into typed objects |
| 14-16 | Rules engine + vitest for all 7 tests | All tests green, no model involved |
| 16-19 | Agents on Mozaik (port `run-agent.ts` from the spike) | Terminal run shows overlap and correct findings |
| 19-21 | SQLite + SSE endpoint | Events stream live |

Checkpoint 21:00: if agents are not working end to end, drop the optional items.

### Build day 2 - Thu 27 Nov (product)

| Block | Task | Done when |
| --- | --- | --- |
| 09-12 | Port the approved dashboard + upload dialog, wire to SSE | Real run visible live |
| 12-14 | Findings + evidence wired to real data | Every finding opens its evidence |
| 14-16 | All 7 tests in the UI, error states | 7 of 7 correct |
| 16-17 | impeccable detect, screenshot check against `design/` | No regressions from the design |
| 17-19 | README, architecture diagram, `.env.example` | Fresh clone runs from the README |
| 19-21 | Demo video (2-3 min) | Recorded |
| 21-22 | Final check, submit | Submitted by 22:00 PKT |

---

## 11. Demo video

1. Problem: manual audits miss duplicates and changed bank details.
2. Upload the sample data.
3. Live run: the three agent rows overlap, that is concurrency.
4. Open the bank-change finding, show expected vs found.
5. Show the 3 invoices that passed.
6. Closing line: AI reads and explains, code decides, every step is checked at a Mozaik breakpoint.

---

## 12. Definition of done

- [ ] Three agents run at the same time, visible on the timeline.
- [ ] Shared audit state holds the run; all agents read and write it through tools.
- [ ] PDFs and CSVs upload and parse; bad files show a clear message.
- [ ] All 7 tests pass in vitest and in the UI.
- [ ] Every finding has evidence.
- [ ] Dashboard shows only real events from the run.
- [ ] No API keys or real client data in the repo.
- [ ] `pnpm run typecheck` and `pnpm test` pass.
- [ ] README covers setup, env vars, sample data and how to run.
- [ ] Demo video shows the whole flow.

---

## 13. Risks

| Risk | Fallback |
| --- | --- |
| Hackathon expects the 4.2 runtime API | Decide on 20 Nov from the brief; the spike's pattern ports either way |
| 5.x is days old and may change | Pin 5.0.1 exactly |
| Model misreads a PDF | Clean sample layouts, zod validation, one retry, then an `extraction_failed` finding |
| Rate limits during the demo | Cache extraction by file hash, record the video early |
| Hot reload re-inits the agent module | `globalThis` guard |
| Running out of time | Drop export, then the unusual-amount rule |

---

## 14. Progress

- [x] Mozaik read and verified against the real package
- [x] Concurrency, shared state and events spike
- [x] Dashboard, upload dialog, logo and favicon
- [ ] Spike run with a real model
- [ ] Mozaik version decided
- [ ] Sample data for 7 tests
- [ ] PDF and CSV parsing test
- [ ] DESIGN.md + tokens.css
- [ ] Architecture frozen
- [ ] Registration and rules verified
- [ ] Ingestion built
- [ ] Rules engine + tests
- [ ] Agents implemented
- [ ] SSE + dashboard integrated
- [ ] 7 tests pass end to end
- [ ] README + demo video
- [ ] Submitted
