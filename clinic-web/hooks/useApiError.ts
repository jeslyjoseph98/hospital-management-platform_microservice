"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ApiRequestError, UnauthorizedError } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { FieldError } from "@/lib/types";

/**
 * Centralizes CW-R6/CW-R8 handling: 401 -> clear token + redirect to /login,
 * 503 -> toast, 409/other business errors -> toast with server message,
 * 400 -> returns fieldErrors so the caller can map them onto form fields.
 */
export function useApiError() {
  const router = useRouter();
  const { logout } = useAuth();
  const { showToast } = useToast();

  const handle = useCallback(
    (error: unknown): FieldError[] => {
      if (error instanceof UnauthorizedError) {
        logout();
        router.push("/login");
        return [];
      }
      if (error instanceof ApiRequestError) {
        if (error.status === 503) {
          showToast("Service temporarily unavailable, please try again.");
          return [];
        }
        if (error.fieldErrors.length > 0) {
          return error.fieldErrors;
        }
        showToast(error.message);
        return [];
      }
      showToast("Something went wrong. Please try again.");
      return [];
    },
    [logout, router, showToast]
  );

  return { handle };
}
