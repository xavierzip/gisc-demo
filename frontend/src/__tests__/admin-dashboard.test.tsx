/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AdminDashboardPage from "@/app/admin/dashboard/page";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe("AdminDashboardPage", () => {
  it("shows loading state initially", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays dashboard stats", async () => {
    localStorage.setItem("gisc_token", "admin-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events_by_status: { published: 5, draft: 2, cancelled: 1 },
        total_registrations: 42,
        total_comments: 18,
        visible_comments: 15,
      }),
    });

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("published")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("Registrations")).toBeInTheDocument();
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("Comments")).toBeInTheDocument();
    });
  });
});
