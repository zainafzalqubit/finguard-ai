const CURRENCY_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$5,000.00", "5000", "5,000.5" -> cents. Throws on anything that is not a plain amount. */
export function toCents(value: string | number): number {
  const text = String(value).replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error(`Not an amount: "${value}"`);
  const [whole = "0", fraction = ""] = text.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number(whole)) * 100 + Number(fraction.padEnd(2, "0")));
}

export function formatCents(cents: number): string {
  return CURRENCY_FORMAT.format(cents / 100);
}

/** Bank accounts are shown by their last 4 digits only. */
export function maskAccount(account: string): string {
  return `ending ${account.slice(-4)}`;
}
