import { describe, expect, it } from "vitest";
import { distanceM, formatDistance } from "@/lib/places-shared";
import { roundCoord, prettyCuisine } from "@/lib/osm/places";

describe("geo helpers", () => {
  it("computes distances", () => {
    // Austin Capitol → UT Tower is ~1.5 km
    expect(distanceM({ lat: 30.2747, lng: -97.7404 }, { lat: 30.2862, lng: -97.7394 })).toBeGreaterThan(1200);
    expect(distanceM({ lat: 30.2747, lng: -97.7404 }, { lat: 30.2862, lng: -97.7394 })).toBeLessThan(1400);
  });
  it("formats distances", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(487)).toBe("490 m");
    expect(formatDistance(1520)).toBe("1.5 km");
    expect(formatDistance(23_400)).toBe("23 km");
  });
  it("rounds coordinates to ~110 m before sending them anywhere", () => {
    expect(roundCoord(30.267153)).toBe(30.267);
    expect(roundCoord(-97.743061)).toBe(-97.743);
  });
  it("prettifies OSM cuisine tags", () => {
    expect(prettyCuisine("middle_eastern;falafel")).toBe("Middle eastern");
    expect(prettyCuisine(undefined)).toBeNull();
  });
});
