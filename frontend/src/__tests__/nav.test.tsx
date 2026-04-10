/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import Nav from "@/components/nav";

jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock("next/navigation", () => ({
  usePathname: () => "/events",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
});

describe("Nav", () => {
  it("renders public links", () => {
    render(<Nav />);
    expect(screen.getByText("GISC")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("shows login button when not authenticated", () => {
    render(<Nav />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });

  it("shows user links when authenticated as user", () => {
    // Create a fake JWT with role=user
    const payload = btoa(JSON.stringify({ sub: "1", role: "user" }));
    localStorage.setItem("gisc_token", `header.${payload}.sig`);

    render(<Nav />);
    expect(screen.getByText("My Events")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows admin links when authenticated as admin", () => {
    const payload = btoa(JSON.stringify({ sub: "2", role: "admin" }));
    localStorage.setItem("gisc_token", `header.${payload}.sig`);

    render(<Nav />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Manage Events")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
  });
});
