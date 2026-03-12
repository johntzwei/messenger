import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "./firebase-mock";

// Mock useMessages
vi.mock("../useMessages", () => ({
  useMessages: vi.fn(() => ({
    messages: [
      { id: "1", text: ":wq", senderId: "vim-user", senderName: "Vim Guy", timestamp: null },
    ],
    send: vi.fn(),
    error: null,
  })),
}));

import VimChat from "../rooms/VimChat";

const defaultProps = {
  roomId: "vim",
  userId: "test-user-id",
  userName: "Test User",
  userEmail: "test@example.com",
  db: {} as any,
};

describe("VimChat", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  it("renders vim editor on desktop", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });

    render(<VimChat {...defaultProps} />);

    expect(screen.getByText("NORMAL")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.queryByText("Vim mode is desktop only")).not.toBeInTheDocument();
  });

  it("shows disabled notice on iPhone", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      configurable: true,
    });

    render(<VimChat {...defaultProps} />);

    expect(screen.getByText("Vim mode is desktop only")).toBeInTheDocument();
    expect(screen.queryByText("NORMAL")).not.toBeInTheDocument();
  });

  it("shows disabled notice on Android", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
      configurable: true,
    });

    render(<VimChat {...defaultProps} />);

    expect(screen.getByText("Vim mode is desktop only")).toBeInTheDocument();
  });

  it("has vim-chat class for terminal theme", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });

    const { container } = render(<VimChat {...defaultProps} />);

    expect(container.querySelector(".vim-chat")).toBeInTheDocument();
  });

  it("renders messages in vim chat", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });

    render(<VimChat {...defaultProps} />);

    expect(screen.getByText(":wq")).toBeInTheDocument();
    expect(screen.getByText("Vim Guy")).toBeInTheDocument();
  });
});
