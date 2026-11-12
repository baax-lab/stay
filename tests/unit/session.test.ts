import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/session";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

const secret = "x".repeat(40);

describe("Session-Cookie", () => {
  it("signiert und prüft", async () => {
    const token = await signSession({ id: "u1", name: "Max", email: "max@baax.de", role: "LEITUNG" }, secret);
    const user = await verifySession(token, secret);
    expect(user).toEqual({ id: "u1", name: "Max", email: "max@baax.de", role: "LEITUNG" });
  });

  it("lehnt falsches Geheimnis und Manipulation ab", async () => {
    const token = await signSession({ id: "u1", name: "Max", email: "m@x.de", role: "PRAKTIKANT" }, secret);
    expect(await verifySession(token, "y".repeat(40))).toBeNull();
    expect(await verifySession(token.slice(0, -2) + "ab", secret)).toBeNull();
    expect(await verifySession("kaputt", secret)).toBeNull();
  });
});

describe("Rate-Limit", () => {
  it("sperrt nach dem Limit und gibt nach dem Fenster frei", () => {
    resetRateLimits();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimit("ip", 5, 60_000, t0 + i).ok).toBe(true);
    const blocked = rateLimit("ip", 5, 60_000, t0 + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("ip", 5, 60_000, t0 + 60_001).ok).toBe(true);
    expect(rateLimit("andere-ip", 5, 60_000, t0 + 11).ok).toBe(true);
  });
});
