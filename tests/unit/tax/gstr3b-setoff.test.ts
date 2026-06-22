// ============================================================
// Unit tests — GSTR-3B ITC set-off + carry-forward
// ============================================================

import { describe, it, expect } from "vitest";
import { applyItcSetOff, type TaxHeads } from "@/lib/tax/gst/gstr3b";

const zero: TaxHeads = { igst: 0, cgst: 0, sgst: 0, cess: 0 };

describe("applyItcSetOff", () => {
  it("pays cash when there is no ITC", () => {
    const out: TaxHeads = { igst: 0, cgst: 9000, sgst: 9000, cess: 0 };
    const { netPayable, closing } = applyItcSetOff(out, zero, zero);
    expect(netPayable).toEqual({ igst: 0, cgst: 9000, sgst: 9000, cess: 0 });
    expect(closing).toEqual(zero);
  });

  it("offsets own-head ITC first and carries the surplus forward", () => {
    const out: TaxHeads = { igst: 0, cgst: 3600, sgst: 3600, cess: 0 };
    const itc: TaxHeads = { igst: 0, cgst: 5000, sgst: 5000, cess: 0 };
    const { netPayable, closing } = applyItcSetOff(out, itc, zero);
    expect(netPayable).toEqual(zero);
    expect(closing).toEqual({ igst: 0, cgst: 1400, sgst: 1400, cess: 0 });
  });

  it("cross-utilizes leftover IGST credit against CGST then SGST", () => {
    const out: TaxHeads = { igst: 0, cgst: 5000, sgst: 5000, cess: 0 };
    const itc: TaxHeads = { igst: 12000, cgst: 0, sgst: 0, cess: 0 };
    const { netPayable, closing } = applyItcSetOff(out, itc, zero);
    // 12000 IGST credit: 5000 → CGST, 5000 → SGST, 2000 left over.
    expect(netPayable).toEqual(zero);
    expect(closing.igst).toBe(2000);
  });

  it("adds carried-forward closing ITC to the available pool", () => {
    const out: TaxHeads = { igst: 0, cgst: 4000, sgst: 4000, cess: 0 };
    const itc: TaxHeads = { igst: 0, cgst: 1000, sgst: 1000, cess: 0 };
    const cf: TaxHeads = { igst: 0, cgst: 4000, sgst: 4000, cess: 0 };
    const { netPayable } = applyItcSetOff(out, itc, cf);
    // 5000 available vs 4000 liability per head ⇒ nothing payable.
    expect(netPayable.cgst).toBe(0);
    expect(netPayable.sgst).toBe(0);
  });

  it("leaves a cash shortfall when credit is insufficient", () => {
    const out: TaxHeads = { igst: 10000, cgst: 0, sgst: 0, cess: 0 };
    const itc: TaxHeads = { igst: 4000, cgst: 0, sgst: 0, cess: 0 };
    const { netPayable, closing } = applyItcSetOff(out, itc, zero);
    expect(netPayable.igst).toBe(6000);
    expect(closing.igst).toBe(0);
  });
});
