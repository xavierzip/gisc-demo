/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe("LoginPage", () => {
  it("renders login form by default", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Full Name")).not.toBeInTheDocument();
  });

  it("switches to register form", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText("Register"));
    expect(screen.getByText("Create Account")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full Name")).toBeInTheDocument();
  });

  it("handles successful login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-token-123" }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "pass123" } });
    fireEvent.submit(screen.getByPlaceholderText("Email").closest("form")!);

    await waitFor(() => {
      expect(localStorage.getItem("gisc_token")).toBe("jwt-token-123");
    });
  });

  it("shows error on failed login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Unauthorized",
      json: async () => ({ error: "Invalid credentials" }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "bad@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong" } });
    fireEvent.submit(screen.getByPlaceholderText("Email").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("handles successful registration", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "new-user-token" }),
    });

    render(<LoginPage />);
    // Switch to register
    fireEvent.click(screen.getByText("Register"));
    fireEvent.change(screen.getByPlaceholderText("Full Name"), { target: { value: "New User" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "pass123" } });
    fireEvent.submit(screen.getByPlaceholderText("Email").closest("form")!);

    await waitFor(() => {
      expect(localStorage.getItem("gisc_token")).toBe("new-user-token");
    });
  });
});
