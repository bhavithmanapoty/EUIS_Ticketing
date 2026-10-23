import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptTicketId, encryptTicketId } from "@/lib/qr-crypto";

const KEY = randomBytes(32).toString("hex");
const OTHER_KEY = randomBytes(32).toString("hex");

describe("qr-crypto", () => {
  it("round-trips a ticket id", () => {
    const id = randomUUID();
    const token = encryptTicketId(id, KEY);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(64);
    expect(decryptTicketId(token, KEY)).toBe(id);
  });

  it("uses a fresh IV each time", () => {
    const id = randomUUID();
    expect(encryptTicketId(id, KEY)).not.toBe(encryptTicketId(id, KEY));
  });

  it("rejects a tampered token", () => {
    const token = encryptTicketId(randomUUID(), KEY);
    const i = 20;
    const flipped = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
    expect(decryptTicketId(flipped, KEY)).toBeNull();
  });

  it("rejects a token made with another key", () => {
    expect(decryptTicketId(encryptTicketId(randomUUID(), OTHER_KEY), KEY)).toBeNull();
  });

  it("rejects junk", () => {
    expect(decryptTicketId("", KEY)).toBeNull();
    expect(decryptTicketId("hello world", KEY)).toBeNull();
    expect(decryptTicketId("https://example.com/ticket", KEY)).toBeNull();
  });

  it("requires a 64-hex-char key", () => {
    expect(() => encryptTicketId(randomUUID(), "abc")).toThrow(/QR_SECRET_KEY/);
  });
});
