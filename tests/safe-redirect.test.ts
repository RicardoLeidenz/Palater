import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps relative app paths", () => {
    expect(safeNextPath("/restaurants/abc")).toBe("/restaurants/abc");
  });
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "falls back to / for %s",
    (input) => {
      expect(safeNextPath(input)).toBe("/");
    },
  );
});
