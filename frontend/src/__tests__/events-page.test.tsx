/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import EventsPage from "@/app/(public)/events/page";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("EventsPage", () => {
  it("shows empty state", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, per_page: 20 }),
    });
    render(<EventsPage />);
    await waitFor(() => {
      expect(screen.getByText("No events available.")).toBeInTheDocument();
    });
  });

  it("renders event cards with cover images", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 1,
            title: "Cloud Workshop",
            category: "workshop",
            location: "Lab A",
            start_time: "2026-06-01T09:00:00",
            capacity: 30,
            cover_image: "/s3/covers/1.jpg",
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      }),
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Cloud Workshop")).toBeInTheDocument();
      expect(screen.getByText(/workshop/)).toBeInTheDocument();
      expect(screen.getByAltText("Cloud Workshop")).toHaveAttribute("src", "/s3/covers/1.jpg");
    });
  });

  it("links to event detail page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 5, title: "Test Event", category: "meetup", location: "Online", start_time: "2026-07-01T10:00:00", cover_image: null },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      }),
    });

    render(<EventsPage />);

    await waitFor(() => {
      const link = screen.getByText("Test Event").closest("a");
      expect(link).toHaveAttribute("href", "/events/detail?id=5");
    });
  });
});
