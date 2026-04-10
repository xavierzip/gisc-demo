/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe("Home", () => {
  it("renders heading and CTA buttons", () => {
    render(<Home />);
    expect(screen.getByText("GISC Event Management")).toBeInTheDocument();
    expect(screen.getByText("Browse Events")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders feature cards", () => {
    render(<Home />);
    expect(screen.getByText("Discover Events")).toBeInTheDocument();
    expect(screen.getByText("Register & Comment")).toBeInTheDocument();
    expect(screen.getByText("Stay Updated")).toBeInTheDocument();
  });

  it("links to events page", () => {
    render(<Home />);
    const link = screen.getByText("Browse Events").closest("a");
    expect(link).toHaveAttribute("href", "/events");
  });
});
