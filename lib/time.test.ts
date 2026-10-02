import { describe, expect, it } from "vitest";
import { HOUR_MS, MINUTE_MS, dayOf, dayParts, monthIndex, monthIndexToStartDay, offsetResolver, weekStart, weekdayOf } from "@/lib/time";

describe("offsetResolver", () => {
  it("follows daylight saving changes", () => {
    const newYork = offsetResolver("America/New_York");
    expect(newYork(Date.UTC(2024, 2, 10, 6, 59, 59))).toBe(-5 * HOUR_MS);
    expect(newYork(Date.UTC(2024, 2, 10, 7, 0, 0))).toBe(-4 * HOUR_MS);
    expect(newYork(Date.UTC(2024, 10, 3, 5, 59, 59))).toBe(-4 * HOUR_MS);
    expect(newYork(Date.UTC(2024, 10, 3, 6, 0, 0))).toBe(-5 * HOUR_MS);
  });

  it("handles half-hour zones and half-hour transitions", () => {
    expect(offsetResolver("Asia/Kolkata")(Date.UTC(2024, 5, 1))).toBe(5 * HOUR_MS + 30 * MINUTE_MS);
    const adelaide = offsetResolver("Australia/Adelaide");
    // Daylight saving ended at 03:00 local (16:30 UTC) on 7 April 2024.
    expect(adelaide(Date.UTC(2024, 3, 6, 16, 29, 59))).toBe(10.5 * HOUR_MS);
    expect(adelaide(Date.UTC(2024, 3, 6, 16, 30, 0))).toBe(9.5 * HOUR_MS);
  });

  it("is zero for UTC", () => {
    expect(offsetResolver("UTC")(Date.UTC(2024, 0, 1))).toBe(0);
  });
});

describe("day numbers", () => {
  it("round-trips dates, weekdays and months", () => {
    const day = dayOf(2024, 1, 29);
    expect(dayParts(day)).toEqual({ year: 2024, month: 1, date: 29 });
    expect(weekdayOf(dayOf(2024, 0, 1))).toBe(0); // Monday
    expect(weekdayOf(dayOf(2024, 0, 7))).toBe(6); // Sunday
    expect(weekStart(dayOf(2024, 0, 7))).toBe(dayOf(2024, 0, 1));
    expect(monthIndexToStartDay(monthIndex(day))).toBe(dayOf(2024, 1, 1));
    expect(weekdayOf(dayOf(1969, 11, 29))).toBe(0); // negative day numbers too
  });
});
