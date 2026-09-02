import { describe, expect, it } from "vitest";
import { getDailySuggestions } from "@/components/chat/empty-state";

describe("daily chat suggestions", () => {
  it("shows four distinct suggestions for a given day", () => {
    const suggestions = getDailySuggestions("2026-09-02");

    expect(suggestions).toHaveLength(4);
    expect(new Set(suggestions.map((suggestion) => suggestion.title)).size).toBe(4);
  });

  it("rotates the suggestion set on the following day", () => {
    const today = getDailySuggestions("2026-09-02").map((suggestion) => suggestion.title);
    const tomorrow = getDailySuggestions("2026-09-03").map((suggestion) => suggestion.title);

    expect(tomorrow).not.toEqual(today);
  });
});
