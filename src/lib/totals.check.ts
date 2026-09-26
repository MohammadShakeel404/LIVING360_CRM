// Self-check for money math. Run: npm run check
import assert from "node:assert/strict";
import { quotationTotals, invoiceTotals, amountInWords } from "./totals";

// 3,00,000 kitchen + 42 × 1,850 TV unit, 10% overall discount, 18% GST.
const q = quotationTotals(
  [
    { quantity: 1, rate: 300000, discountPct: 0, gstPct: 18 },
    { quantity: 42, rate: 1850, discountPct: 0, gstPct: 18 },
  ],
  10
);
assert.deepEqual(q, { subtotal: 377700, itemDiscounts: 0, overallDiscount: 37770, taxable: 339930, gst: 61187.4, grandTotal: 401117.4 });

// Line discount is applied before the overall discount, GST on what's left; mixed GST rates.
const m = quotationTotals(
  [
    { quantity: 2, rate: 1000, discountPct: 10, gstPct: 18 }, // 1800 net → 1620 after 10% → GST 291.6
    { quantity: 1, rate: 500, discountPct: 0, gstPct: 0 }, // 500 → 450, no GST
  ],
  10
);
assert.equal(m.itemDiscounts, 200);
assert.equal(m.taxable, 2070);
assert.equal(m.gst, 291.6);
assert.equal(m.grandTotal, 2361.6);

assert.deepEqual(invoiceTotals([{ quantity: 1, rate: 169965, gstPct: 18 }]), { taxable: 169965, gst: 30593.7, grandTotal: 200558.7 });

assert.equal(amountInWords(401117.4), "Rupees Four Lakh One Thousand One Hundred Seventeen and Forty Paise Only");
assert.equal(amountInWords(12500000), "Rupees One Crore Twenty Five Lakh Only");
assert.equal(amountInWords(0), "Rupees Zero Only");

console.log("totals: all checks passed");
