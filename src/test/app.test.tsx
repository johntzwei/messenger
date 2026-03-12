import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "./firebase-mock";

// Must import components after firebase mock is set up
import Home from "../Home";
import MessageList from "../rooms/MessageList";
import GeneralChat from "../rooms/GeneralChat";
import type { Message } from "../useMessages";

// Mock useMessages for GeneralChat
vi.mock("../useMessages", () => ({
  useMessages: vi.fn(() => ({
    messages: [
      { id: "1", text: "Hello", senderId: "user-a", senderName: "Alice", timestamp: null },
      { id: "2", text: "Hi there", senderId: "test-user-id", senderName: "Test User", timestamp: null },
    ],
    send: vi.fn(),
    error: null,
  })),
}));

// Mock swipe gesture (needs DOM refs)
vi.mock("../useSwipeGesture", () => ({
  useSwipeGesture: vi.fn(),
}));

describe("Home screen", () => {
  it("renders all room buttons", () => {
    const onSelect = vi.fn();
    render(<Home onSelectRoom={onSelect} />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
    expect(screen.getByText("Vim Users Only")).toBeInTheDocument();
  });

  it("calls onSelectRoom when a room is clicked", () => {
    const onSelect = vi.fn();
    render(<Home onSelectRoom={onSelect} />);

    screen.getByText("General").click();
    expect(onSelect).toHaveBeenCalledWith("general");

    screen.getByText("Vim Users Only").click();
    expect(onSelect).toHaveBeenCalledWith("vim");
  });
});

describe("MessageList", () => {
  const messages: Message[] = [
    { id: "1", text: "Hello world", senderId: "user-a", senderName: "Alice", timestamp: null },
    { id: "2", text: "My message", senderId: "me", senderName: "Me", timestamp: null },
  ];

  it("renders messages with sender names", () => {
    render(<MessageList messages={messages} error={null} userId="me" />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("My message")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Me")).toBeInTheDocument();
  });

  it("applies mine class to own messages", () => {
    render(<MessageList messages={messages} error={null} userId="me" />);

    const myBubble = screen.getByText("My message");
    expect(myBubble.className).toContain("mine");

    const otherBubble = screen.getByText("Hello world");
    expect(otherBubble.className).not.toContain("mine");
  });

  it("shows error when present", () => {
    render(<MessageList messages={[]} error="Something broke" userId="me" />);
    expect(screen.getByText("Error: Something broke")).toBeInTheDocument();
  });

  it("renders empty state without crashing", () => {
    render(<MessageList messages={[]} error={null} userId="me" />);
    // Should render without errors
    expect(document.querySelector(".chat-messages")).toBeInTheDocument();
  });
});

describe("GeneralChat", () => {
  it("renders chat input and send button", () => {
    render(
      <GeneralChat
        roomId="general"
        userId="test-user-id"
        userName="Test User"
        userEmail="test@example.com"
        db={{} as any}
      />
    );

    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("has mobile-friendly input attributes", () => {
    render(
      <GeneralChat
        roomId="general"
        userId="test-user-id"
        userName="Test User"
        userEmail="test@example.com"
        db={{} as any}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "off");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("renders messages from useMessages hook", () => {
    render(
      <GeneralChat
        roomId="general"
        userId="test-user-id"
        userName="Test User"
        userEmail="test@example.com"
        db={{} as any}
      />
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });
});
