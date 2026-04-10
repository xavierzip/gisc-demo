/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NotificationsPage from "@/app/(user)/notifications/page";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe("NotificationsPage", () => {
  it("shows empty state when no token", () => {
    render(<NotificationsPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("No notifications.")).toBeInTheDocument();
  });

  it("loads and displays notifications", async () => {
    localStorage.setItem("gisc_token", "test-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          type: "event_update",
          title: "Event Updated",
          body: "Start time changed",
          is_read: false,
          created_at: "2026-04-01T10:00:00",
        },
      ],
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Updated")).toBeInTheDocument();
      expect(screen.getByText("Start time changed")).toBeInTheDocument();
    });
  });

  it("marks notification as read on click", async () => {
    localStorage.setItem("gisc_token", "test-token");
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 5,
            type: "event_update",
            title: "Clickable Notification",
            body: null,
            is_read: false,
            created_at: "2026-04-01T10:00:00",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "read" }),
      });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Clickable Notification")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clickable Notification"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Second call should be the mark-read POST
      expect(mockFetch.mock.calls[1][0]).toContain("/notifications/5/read");
    });
  });
});
