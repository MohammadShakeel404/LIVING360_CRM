// Self-check for money math. Run: npm run check
import assert from "node:assert/strict";
import { quotationTotals, invoiceTotals, amountInWords } from "./totals";
import { payableFor, assignmentSummary, labourSummary } from "./workers";

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

// Workers: payable = rate x days, stage-wise paid/balance, direct payments, per-trade rollup.
assert.equal(payableFor({ rateType: "DAILY", rate: 900, quantity: 22.5, agreedAmount: null }), 20250);
assert.equal(payableFor({ rateType: "LUMP_SUM", rate: null, quantity: null, agreedAmount: 60000 }), 60000);
const w = assignmentSummary({
  agreedAmount: 60000,
  stages: [{ id: "s1", label: "Advance", amount: 20000 }, { id: "s2", label: "Frames", amount: 25000 }, { id: "s3", label: "Finish", amount: 15000 }],
  payments: [{ amount: 20000, stageId: "s1" }, { amount: 10000, stageId: "s2" }, { amount: 5000, stageId: null }],
});
assert.deepEqual([w.paid, w.balance, w.direct], [35000, 25000, 5000]);
assert.deepEqual(w.stages.map((x) => x.balance), [0, 15000, 15000]);
const lab = labourSummary([{ trade: "Carpenter", payable: 60000, paid: 35000 }, { trade: "Carpenter", payable: 20000, paid: 20000 }, { trade: "Painter", payable: 30000, paid: 0 }]);
assert.deepEqual([lab.payable, lab.paid, lab.balance], [110000, 55000, 55000]);
assert.deepEqual(lab.byTrade[0], { trade: "Carpenter", payable: 80000, paid: 55000, workers: 2, balance: 25000 });

console.log("totals: all checks passed");
