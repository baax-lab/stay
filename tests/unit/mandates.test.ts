import { describe, expect, it } from "vitest";
import { allowedTransitions, checkTransition } from "@/lib/mandates";
import { deriveLicenseLight } from "@/lib/license";
import { closingTemplate } from "@/lib/checklists";

describe("Statuslogik Suchauftrag", () => {
  it("nur erlaubte Folgestatus", () => {
    expect(allowedTransitions("ERSTGESPRAECH")).toEqual(["BEAUFTRAGT", "PAUSIERT", "BEENDET_OHNE_KAUF"]);
    expect(allowedTransitions("VERHANDLUNG")).toContain("GEKAUFT");
    expect(allowedTransitions("VERHANDLUNG")).toContain("SUCHE");
    expect(allowedTransitions("GEKAUFT")).toEqual(["NACHBETREUUNG"]);
    expect(allowedTransitions("ABGESCHLOSSEN")).toEqual([]);
  });

  it("Rückkehr aus Pausiert in den vorherigen Status", () => {
    expect(allowedTransitions("PAUSIERT", "PRUEFUNG")).toEqual(["PRUEFUNG", "BEENDET_OHNE_KAUF"]);
  });

  it("BEAUFTRAGT verlangt GwG-Identifizierung", () => {
    const r = checkTransition({ status: "ERSTGESPRAECH", gwgIdentifiedAt: null }, "BEAUFTRAGT");
    expect(r.ok).toBe(false);
    expect(checkTransition({ status: "ERSTGESPRAECH", gwgIdentifiedAt: new Date() }, "BEAUFTRAGT").ok).toBe(true);
  });

  it("BEENDET_OHNE_KAUF verlangt Grund, GEKAUFT verlangt Kaufpreis", () => {
    expect(checkTransition({ status: "SUCHE" }, "BEENDET_OHNE_KAUF").ok).toBe(false);
    expect(checkTransition({ status: "SUCHE" }, "BEENDET_OHNE_KAUF", { endReason: "Budget nicht darstellbar" }).ok).toBe(true);
    expect(checkTransition({ status: "VERHANDLUNG" }, "GEKAUFT").ok).toBe(false);
    expect(checkTransition({ status: "VERHANDLUNG" }, "GEKAUFT", { purchasePrice: 900_000 }).ok).toBe(true);
  });
});

describe("Genehmigungsampel", () => {
  it("leitet aus Lizenzstatus und Regionsregel ab", () => {
    expect(deriveLicenseLight("VORHANDEN").light).toBe("GRUEN");
    expect(deriveLicenseLight("BEANTRAGT").light).toBe("GELB");
    expect(deriveLicenseLight("BEANTRAGT", "Vergabestopp seit 2022").light).toBe("ROT");
    expect(deriveLicenseLight("FEHLT").light).toBe("ROT");
    expect(deriveLicenseLight("UNKLAR").light).toBe("GRAU");
    expect(deriveLicenseLight("NICHT_NOETIG").light).toBe("GRUEN");
  });
});

describe("Kaufabwicklung", () => {
  it("Checklisten je Land", () => {
    expect(closingTemplate("ES").map((i) => i.key)).toContain("nie");
    expect(closingTemplate("DE").map((i) => i.key)).toContain("grunderwerbsteuer");
    expect(closingTemplate("PT").map((i) => i.key)).toEqual(["finanzierung", "anwalt_notar", "vorvertrag", "anzahlung", "beurkundung", "uebergabe"]);
  });
});
