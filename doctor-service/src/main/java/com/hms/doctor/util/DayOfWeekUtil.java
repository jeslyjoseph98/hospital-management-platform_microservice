package com.hms.doctor.util;

public final class DayOfWeekUtil {

    private static final String[] NAMES = {
            "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
    };

    private DayOfWeekUtil() {
    }

    /** dayOfWeek: 1 = Monday ... 7 = Sunday */
    public static String name(int dayOfWeek) {
        if (dayOfWeek < 1 || dayOfWeek > 7) {
            throw new IllegalArgumentException("dayOfWeek must be between 1 and 7");
        }
        return NAMES[dayOfWeek - 1];
    }
}
