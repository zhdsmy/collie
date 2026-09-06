import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { __resetDesign, setDesignTheme } from "@/lib/design";

describe("Animal Island shared primitives", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    __resetDesign();
    setDesignTheme("animal-island");
  });

  it("uses the official button adapter for every shared action", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("data-animal-type", "primary");
    expect(button).toHaveAttribute("data-slot", "button");
  });

  it("keeps secondary actions at the library's default emphasis", () => {
    render(<Button variant="secondary">Later</Button>);
    expect(screen.getByRole("button", { name: "Later" })).toHaveAttribute("data-animal-type", "default");
  });

  it("uses the official card adapter while retaining Collie's data slot", () => {
    render(<Card>Pane</Card>);
    expect(screen.getByText("Pane").closest("[data-slot='card']")).toHaveClass("collie-island-card");
  });
});
