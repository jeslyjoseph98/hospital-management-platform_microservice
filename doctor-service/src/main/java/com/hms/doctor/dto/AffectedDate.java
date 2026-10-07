package com.hms.doctor.dto;

public class AffectedDate {
    private String date;
    private int booked;

    public AffectedDate() {
    }

    public AffectedDate(String date, int booked) {
        this.date = date;
        this.booked = booked;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public int getBooked() {
        return booked;
    }

    public void setBooked(int booked) {
        this.booked = booked;
    }
}
