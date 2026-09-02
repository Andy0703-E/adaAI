/**
 * @vitest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/chat/composer";

const sessionState = vi.hoisted(() => ({
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: sessionState.status }),
}));

vi.mock("@/components/model/model-selector", () => ({
  ModelSelector: ({ selectedModelId }: { selectedModelId: string }) => (
    <button type="button">{selectedModelId}</button>
  ),
}));

const file = new File(["document"], "nama-dokumen-yang-sangat-panjang-sekali.txt", {
  type: "text/plain",
});

function renderComposer(overrides: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const props: React.ComponentProps<typeof Composer> = {
    value: "prompt",
    onChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isGenerating: false,
    modelId: "Deepseek V4 Flash Vision Exp",
    ...overrides,
  };
  const view = render(<Composer {...props} />);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...view, input, props };
}

describe("Composer attachment preparation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
    sessionState.status = "authenticated";
  });

  it("disables attachment for guest and loading session", () => {
    sessionState.status = "unauthenticated";
    const { container, rerender, props } = renderComposer();

    const button = container.querySelector('button[title="Masuk untuk mengunggah dokumen"]') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);

    sessionState.status = "loading";
    rerender(<Composer {...props} />);
    expect((container.querySelector('button[title="Memuat sesi..."]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("guest click does not open file picker or call upload flow", () => {
    sessionState.status = "unauthenticated";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    const { container } = renderComposer({ onCreateConversation: create });

    fireEvent.click(container.querySelector('button[title="Masuk untuk mengunggah dokumen"]')!);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("uploads directly to an existing conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "attachment-1", name: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn();
    const { input } = renderComposer({ conversationId: "conversation-existing", onCreateConversation: create });

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(file.name);
    expect(create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/conversations/conversation-existing/attachments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("attaches for authenticated New Chat without breaking auto-create", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "attachment-1", name: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn().mockResolvedValue("conversation-new");
    const { input } = renderComposer({ onCreateConversation: create });

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(file.name);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/conversations/conversation-new/attachments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("creates a conversation before uploading on New Chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "attachment-1", name: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn().mockResolvedValue("conversation-new");
    const { input } = renderComposer({ onCreateConversation: create });

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(file.name);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/conversations/conversation-new/attachments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not upload when conversation creation fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { input } = renderComposer({ onCreateConversation: vi.fn().mockResolvedValue(null) });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the created conversation when upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Upload gagal" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn().mockResolvedValue("conversation-new");
    const { input, rerender, props } = renderComposer({ onCreateConversation: create });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Upload gagal"));
    rerender(<Composer {...props} conversationId="conversation-new" />);

    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(file.name)).toBeNull();
  });

  it("uses flow-safe responsive classes for actions and long filenames", () => {
    const { container } = renderComposer({ conversationId: "conversation-existing" });
    const textarea = screen.getByRole("textbox");
    const modelWrapper = screen.getByText("Deepseek V4 Flash Vision Exp").parentElement;
    const actionRow = modelWrapper?.parentElement;

    expect(textarea.className).toContain("w-full");
    expect(textarea.className).toContain("min-h-[26px]");
    expect(textarea.className).toContain("overflow-hidden");
    expect(modelWrapper?.className).toContain("max-w-[160px]");
    expect(modelWrapper?.className).toContain("lg:max-w-[300px]");
    expect(actionRow?.className).toContain("justify-end");
    expect(actionRow?.className).not.toContain("absolute");
    expect(container.querySelector('[aria-label="Kirim pesan"]')).not.toBeNull();
    expect(container.querySelector('[title="Attach document"]')).not.toBeNull();
  });
});
