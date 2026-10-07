import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiRequestError, ServiceUnavailableError, UnauthorizedError } from "@/lib/apiClient";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    })
  );
}

describe("apiFetch", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data on a successful envelope", async () => {
    mockFetchOnce(200, { success: true, data: { foo: "bar" } });
    const result = await apiFetch<{ foo: string }>("/anything");
    expect(result).toEqual({ foo: "bar" });
  });

  it("throws UnauthorizedError and clears the token on 401", async () => {
    window.sessionStorage.setItem("clinic_web_token", "sometoken");
    mockFetchOnce(401, {
      success: false,
      errorCode: "AUTH_TOKEN_INVALID",
      message: "Invalid token",
      fieldErrors: [],
      data: null,
    });
    await expect(apiFetch("/doctor/appointments/today")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(window.sessionStorage.getItem("clinic_web_token")).toBeNull();
  });

  it("throws ServiceUnavailableError on 503", async () => {
    mockFetchOnce(503, {
      success: false,
      errorCode: "SERVICE_UNAVAILABLE",
      message: "Service temporarily unavailable, please try again.",
      fieldErrors: [],
      data: null,
    });
    await expect(apiFetch("/doctor/appointments/today")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("throws ServiceUnavailableError on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network error"))
    );
    await expect(apiFetch("/doctor/appointments/today")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("throws ApiRequestError with fieldErrors on 400 validation failure", async () => {
    mockFetchOnce(400, {
      success: false,
      errorCode: "VALIDATION_FAILED",
      message: "Validation failed",
      fieldErrors: [{ field: "phone", message: "Phone is required" }],
      data: null,
    });
    try {
      await apiFetch("/auth/register", { method: "POST", skipAuth: true });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError);
      const apiErr = err as ApiRequestError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.fieldErrors).toEqual([{ field: "phone", message: "Phone is required" }]);
    }
  });

  it("carries errorCode through for 409 business errors (e.g. PHR_ALREADY_DISPENSED)", async () => {
    mockFetchOnce(409, {
      success: false,
      errorCode: "PHR_ALREADY_DISPENSED",
      message: "Already dispensed",
      fieldErrors: [],
      data: null,
    });
    try {
      await apiFetch("/pharmacy/prescriptions/abc/dispense", { method: "POST" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError);
      expect((err as ApiRequestError).errorCode).toBe("PHR_ALREADY_DISPENSED");
    }
  });
});
