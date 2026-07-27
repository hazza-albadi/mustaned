// Confirms the Jest + next/jest + TypeScript + "@/*" path alias setup
// genuinely works end to end before any real test relies on it.
import { cn } from "@/lib/utils";

describe("jest setup smoke test", () => {
  it("runs TypeScript tests and resolves the @/* path alias", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
