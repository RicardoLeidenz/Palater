import { describe, expect, it } from "vitest";
import { nameSimilarity, normalizeName } from "@/lib/similarity";

describe("normalizeName", () => {
  it.each([
    ["Crème Brûlée!", "creme brulee"],
    ["  Steak   Frites ", "steak frites"],
    ["Mac & Cheese", "mac cheese"],
    ["Kōyō Ramen", "koyo ramen"],
    ["ラーメン", "ラーメン"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe("nameSimilarity", () => {
  it("treats accent/case/punctuation variants as identical", () => {
    expect(nameSimilarity("Creme brulee", "Crème Brûlée")).toBe(1);
  });
  it("scores containment highly", () => {
    expect(nameSimilarity("Maison Clé", "Maison Clé Bistro")).toBeGreaterThan(0.8);
  });
  it("scores small typos highly", () => {
    expect(nameSimilarity("Tiramisu", "Tiramissu")).toBeGreaterThan(0.75);
  });
  it("scores unrelated names low", () => {
    expect(nameSimilarity("Duck confit", "Moules frites")).toBeLessThan(0.3);
  });
});
