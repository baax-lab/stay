import { describe, expect, it } from "vitest";
import { austriaCap, calculateFee, referralReward, suggestBand } from "@/lib/fees";

const base = { baseFeeActive: false, baseFee: 0, bonusPct: 0.1, bonusCapPct: 0.25 };

describe("Honorar – Testfälle aus dem Konzept", () => {
  it("Bonus gedeckelt: 40.000 / 2.050.000 → 1.900.000 = 10.000", () => {
    const r = calculateFee({ ...base, successFee: 40_000, askingPrice: 2_050_000, purchasePrice: 1_900_000 });
    expect(r.savings).toBe(150_000);
    expect(r.bonusRaw).toBe(15_000);
    expect(r.bonusCap).toBe(10_000);
    expect(r.bonus).toBe(10_000);
    expect(r.total).toBe(50_000);
  });

  it("Bonus unter Deckel: 40.000 / 2.000.000 → 1.950.000 = 5.000", () => {
    const r = calculateFee({ ...base, successFee: 40_000, askingPrice: 2_000_000, purchasePrice: 1_950_000 });
    expect(r.bonus).toBe(5_000);
    expect(r.total).toBe(45_000);
  });

  it("Kaufpreis über Angebot: 18.500 / 800.000 → 820.000 = 0", () => {
    const r = calculateFee({ ...base, successFee: 18_500, askingPrice: 800_000, purchasePrice: 820_000 });
    expect(r.savings).toBe(0);
    expect(r.bonus).toBe(0);
    expect(r.total).toBe(18_500);
  });

  it("Grundhonorar nur wenn aktiv, Verkäuferprovision wird angerechnet", () => {
    const off = calculateFee({ ...base, baseFee: 5_000, successFee: 20_000, askingPrice: null, purchasePrice: null });
    expect(off.total).toBe(20_000);
    const on = calculateFee({ ...base, baseFeeActive: true, baseFee: 5_000, successFee: 20_000, askingPrice: null, purchasePrice: null, sellerSideCredited: 8_000, travelFlat: 500, trips: 2 });
    expect(on.total).toBe(5_000 + 20_000 + 1_000 - 8_000);
  });

  it("Österreich-Höchstsatz 3 % zzgl. 20 % USt", () => {
    expect(austriaCap(1_000_000)).toEqual({ net: 30_000, gross: 36_000 });
  });

  it("Band aus Budget vorschlagen", () => {
    const bands = [
      { id: "a", volumeFrom: 0, volumeTo: 500_000, baseFee: 0, successFee: 12_000, bonusPct: 0.1, bonusCapPct: 0.25 },
      { id: "b", volumeFrom: 500_000, volumeTo: 1_500_000, baseFee: 0, successFee: 25_000, bonusPct: 0.1, bonusCapPct: 0.25 },
      { id: "c", volumeFrom: 1_500_000, volumeTo: null, baseFee: 0, successFee: 40_000, bonusPct: 0.1, bonusCapPct: 0.25 },
    ];
    expect(suggestBand(bands, 300_000)?.id).toBe("a");
    expect(suggestBand(bands, 500_000)?.id).toBe("b");
    expect(suggestBand(bands, 5_000_000)?.id).toBe("c");
    expect(suggestBand([], 100)).toBeNull();
  });

  it("Prämie: prozentual oder pauschal", () => {
    expect(referralReward({ rewardPct: 0.1, rewardFlat: null }, 40_000).amount).toBe(4_000);
    expect(referralReward({ rewardPct: null, rewardFlat: 1_500 }, 40_000).amount).toBe(1_500);
    expect(referralReward({ rewardPct: null, rewardFlat: null }, 40_000).amount).toBe(0);
  });
});
