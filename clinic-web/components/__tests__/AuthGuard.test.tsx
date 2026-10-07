import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/AuthGuard";

const replaceMock = vi.fn();
let mockPathname = "/doctor/today";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => mockPathname,
}));

const showToastMock = vi.fn();
vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

let mockAuthState: {
  user: { role: string } | null;
  loading: boolean;
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    showToastMock.mockClear();
    mockPathname = "/doctor/today";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the auth check is in flight", () => {
    mockAuthState = { user: null, loading: true };
    render(
      <AuthGuard requiredRole="DOCTOR">
        <div>secret</div>
      </AuthGuard>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("redirects to /login when there is no user (CW-R1)", async () => {
    mockAuthState = { user: null, loading: false };
    render(
      <AuthGuard requiredRole="DOCTOR">
        <div>secret</div>
      </AuthGuard>
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });

  it("redirects PATIENT/ADMIN tokens to /login with a message (CW-R2)", async () => {
    mockAuthState = { user: { role: "PATIENT" }, loading: false };
    render(
      <AuthGuard requiredRole="DOCTOR">
        <div>secret</div>
      </AuthGuard>
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(showToastMock).toHaveBeenCalledWith(
      "Please use the patient app / admin portal",
      "error"
    );
  });

  it("bounces a PHARMACIST out of /doctor routes to /pharmacy/prescriptions (CW-R3)", async () => {
    mockPathname = "/doctor/today";
    mockAuthState = { user: { role: "PHARMACIST" }, loading: false };
    render(
      <AuthGuard requiredRole="DOCTOR">
        <div>secret</div>
      </AuthGuard>
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/pharmacy/prescriptions"));
  });

  it("bounces a DOCTOR out of /pharmacy routes to /doctor/today (CW-R4)", async () => {
    mockPathname = "/pharmacy/prescriptions";
    mockAuthState = { user: { role: "DOCTOR" }, loading: false };
    render(
      <AuthGuard requiredRole="PHARMACIST">
        <div>secret</div>
      </AuthGuard>
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/doctor/today"));
  });

  it("renders children once the role matches the route group", async () => {
    mockPathname = "/doctor/today";
    mockAuthState = { user: { role: "DOCTOR" }, loading: false };
    render(
      <AuthGuard requiredRole="DOCTOR">
        <div>secret</div>
      </AuthGuard>
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
