/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchPage from "@/app/(public)/search/page";

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock next/link to render a plain anchor
jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SearchPage", () => {
  it("renders search form", () => {
    render(<SearchPage />);
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("displays search results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 1, title: "React Workshop", category: "workshop", location: "Online" },
          { id: 2, title: "Go Meetup", category: "meetup", location: "Office" },
        ],
        total: 2,
      }),
    });

    render(<SearchPage />);

    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: "workshop" } });
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("React Workshop")).toBeInTheDocument();
      expect(screen.getByText("Go Meetup")).toBeInTheDocument();
      expect(screen.getByText("2 result(s) found")).toBeInTheDocument();
    });
  });

  it("handles empty results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });

    render(<SearchPage />);

    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: "nonexistent" } });
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.queryByText(/result\(s\) found/)).not.toBeInTheDocument();
    });
  });
});
