import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime24 } from "@/lib/format";

describe("formatDate", () => {
  it("formats YYYY-MM-DD as dd-MM-yyyy", () => {
    expect(formatDate("2026-09-28")).toBe("28-09-2026");
  });

  it("handles a datetime string by taking the date part", () => {
    expect(formatDate("2026-09-28T11:05:00")).toBe("28-09-2026");
  });

  it("returns a placeholder for null/undefined", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });
});

describe("formatTime24", () => {
  it("converts 24h HH:mm to hh:mm AM/PM", () => {
    expect(formatTime24("10:48")).toBe("10:48 AM");
    expect(formatTime24("00:05")).toBe("12:05 AM");
    expect(formatTime24("13:00")).toBe("01:00 PM");
    expect(formatTime24("23:59")).toBe("11:59 PM");
    expect(formatTime24("12:00")).toBe("12:00 PM");
  });

  it("returns a placeholder for null/undefined", () => {
    expect(formatTime24(null)).toBe("-");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO datetime as dd-MM-yyyy hh:mm AM/PM", () => {
    const result = formatDateTime("2026-09-28T11:05:00");
    expect(result).toMatch(/^28-09-2026 \d{2}:\d{2} (AM|PM)$/);
  });

  it("returns a placeholder for null/undefined", () => {
    expect(formatDateTime(null)).toBe("-");
  });
});
