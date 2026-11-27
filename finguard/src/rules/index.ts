import { overpaymentRule, poAmountRule, unpaidRule, vendorMismatchRule } from "./payment-rules";
import { bankChangeRule, duplicateRule, totalsRule } from "./risk-rules";
import type { Rule, RuleContext, RuleHit } from "./types";
import type { Invoice } from "@/domain/types";

/** Tally runs these per invoice. */
export const PAYMENT_RULES: Rule[] = [poAmountRule, overpaymentRule, vendorMismatchRule];
/** Sentinel runs these per invoice. */
export const RISK_RULES: Rule[] = [duplicateRule, bankChangeRule, totalsRule];
/** Run once, after every invoice has been read. */
export const FINAL_RULES: Rule[] = [unpaidRule];

export function applyRules(rules: Rule[], invoice: Invoice, ctx: RuleContext): RuleHit[] {
  return rules.flatMap((rule) => rule(invoice, ctx));
}

export type { Rule, RuleContext, RuleHit } from "./types";
