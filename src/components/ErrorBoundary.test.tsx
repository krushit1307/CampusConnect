import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function ThrowingComponent() {
  throw new Error("Boom from test component");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <p>Healthy application</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Healthy application")).toBeInTheDocument();
  });

  it("catches render errors and shows a friendly recovery screen", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go home/i })).toBeInTheDocument();
  });

  it("supports a custom fallback renderer", () => {
    render(
      <ErrorBoundary fallback={(error) => <div role="alert">Custom fallback: {error.message}</div>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Custom fallback: Boom from test component",
    );
  });
});
