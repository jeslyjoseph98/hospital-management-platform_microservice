"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch } from "@/lib/apiClient";
import { formatDateTime, todayIso } from "@/lib/format";
import type { PendingPrescriptionRow } from "@/lib/types";

type Tab = "pending" | "search";

export default function PharmacyPrescriptionsPage() {
  const router = useRouter();
  const { handle } = useApiError();
  const [tab, setTab] = useState<Tab>("pending");

  const [date, setDate] = useState(todayIso());
  const [pending, setPending] = useState<PendingPrescriptionRow[] | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PendingPrescriptionRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const result = await apiFetch<PendingPrescriptionRow[]>(
        `/pharmacy/prescriptions/pending?date=${encodeURIComponent(date)}`
      );
      setPending(result);
    } catch (err) {
      handle(err);
    } finally {
      setPendingLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (tab === "pending") {
      loadPending();
    }
  }, [tab, loadPending]);

  async function runSearch() {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearched(true);
    try {
      const result = await apiFetch<PendingPrescriptionRow[]>(
        `/pharmacy/prescriptions/search?q=${encodeURIComponent(query.trim())}`
      );
      setSearchResults(result);
    } catch (err) {
      handle(err);
    } finally {
      setSearchLoading(false);
    }
  }

  function renderTable(rows: PendingPrescriptionRow[] | null, loadingState: boolean, emptyText: string) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Completed</th>
              <th>Items</th>
              <th>Dispense</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.consultationId}>
                <td>{row.tokenNumber}</td>
                <td>
                  {row.patientName} ({row.patientCode})
                </td>
                <td>{row.doctorName}</td>
                <td>{formatDateTime(row.completedAt)}</td>
                <td>{row.itemCount}</td>
                <td>
                  <span
                    className={`status-badge ${
                      row.dispenseStatus === "DISPENSED" ? "status-dispensed" : "status-pending"
                    }`}
                  >
                    {row.dispenseStatus}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => router.push(`/pharmacy/prescriptions/${row.consultationId}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loadingState && rows?.length === 0 && <div className="empty-state">{emptyText}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Prescriptions</h1>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab-btn ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "search" ? "active" : ""}`}
          onClick={() => setTab("search")}
        >
          Search
        </button>
      </div>

      {tab === "pending" && (
        <div>
          <div className="search-row">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
            />
            <button type="button" className="btn btn-secondary" onClick={loadPending} disabled={pendingLoading}>
              {pendingLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {renderTable(pending, pendingLoading, "No pending prescriptions for this date.")}
        </div>
      )}

      {tab === "search" && (
        <div>
          <div className="search-row">
            <input
              type="text"
              placeholder="Patient code or appointment code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
            />
            <button type="button" className="btn" onClick={runSearch} disabled={searchLoading || !query.trim()}>
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {searched && renderTable(searchResults, searchLoading, "No matching prescriptions found.")}
        </div>
      )}
    </div>
  );
}
