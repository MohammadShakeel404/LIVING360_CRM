/**
 * Single source of truth for quotation / invoice money math.
 * Order: line base → line discount → overall discount → GST on the discounted value.
 */

type Num = number | string | { toString(): string };
const n = (v: Num | null | undefined) => (v === null || v === undefined ? 0 : Number(v.toString()) || 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

export type QuoteLine = { quantity: Num; rate: Num; discountPct?: Num | null; gstPct?: Num | null };

export function lineNet(item: QuoteLine) {
  const base = n(item.quantity) * n(item.rate);
  return base - base * (n(item.discountPct) / 100);
}

export function quotationTotals(items: QuoteLine[], overallDiscountPct: Num = 0) {
  const overall = n(overallDiscountPct) / 100;
  let subtotal = 0, itemDiscounts = 0, overallDiscount = 0, gst = 0;
  for (const i of items) {
    const base = n(i.quantity) * n(i.rate);
    const net = lineNet(i);
    const od = net * overall;
    subtotal += base;
    itemDiscounts += base - net;
    overallDiscount += od;
    gst += (net - od) * (n(i.gstPct) / 100);
  }
  const taxable = subtotal - itemDiscounts - overallDiscount;
  return {
    subtotal: round2(subtotal),
    itemDiscounts: round2(itemDiscounts),
    overallDiscount: round2(overallDiscount),
    taxable: round2(taxable),
    gst: round2(gst),
    grandTotal: round2(taxable + gst),
  };
}

export type InvoiceLine = { quantity: Num; rate: Num; gstPct?: Num | null };

export function invoiceTotals(items: InvoiceLine[]) {
  let taxable = 0, gst = 0;
  for (const i of items) {
    const amt = n(i.quantity) * n(i.rate);
    taxable += amt;
    gst += amt * (n(i.gstPct) / 100);
  }
  return { taxable: round2(taxable), gst: round2(gst), grandTotal: round2(taxable + gst) };
}

/** Indian-style amount in words, e.g. "Rupees One Lakh Twenty Thousand Only". */
export function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`);
  const three = (x: number) => {
    const h = Math.floor(x / 100), r = x % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  const words = (x: number): string => {
    if (x === 0) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(x / 1e7); x %= 1e7;
    const lakh = Math.floor(x / 1e5); x %= 1e5;
    const thousand = Math.floor(x / 1e3); x %= 1e3;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (x) parts.push(three(x));
    return parts.join(" ");
  };
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  return `Rupees ${words(rupees)}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}
