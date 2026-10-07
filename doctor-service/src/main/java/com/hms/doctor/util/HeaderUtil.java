package com.hms.doctor.util;

import jakarta.servlet.http.HttpServletRequest;

public final class HeaderUtil {

    private HeaderUtil() {
    }

    public static Long userId(HttpServletRequest request) {
        String value = request.getHeader("X-User-Id");
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
