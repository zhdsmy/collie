import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { PlanContent } from "./plan-content";

describe("plan reading area", () => {
  it("keeps the recap in an independent, initially folded Markdown section", () => {
    const view = render(<PlanContent text="# Original plan" complete recap={"## Context\n\n- Keep the **scope**."} />);
    const recap = view.getByText(t("dialog.plan.recap"), { selector: "summary" });
    const details = recap.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    // Native details handles mouse and keyboard activation; browser tests cover its layout.
    details.open = true;
    expect(view.getByRole("region", { name: t("dialog.plan.recap") })).toHaveTextContent("Keep the scope.");
    expect(view.getByRole("region", { name: t("dialog.plan.body") })).not.toHaveTextContent("Keep the scope.");
    fireEvent.click(view.getByRole("button", { name: t("dialog.plan.title") }));
    expect(details).toHaveAttribute("open");
  });

  it("retains the whole long body and lets the user fold it without focusing an input", async () => {
    const paragraphs = Array.from({ length: 200 }, (_, index) => `Paragraph ${index}: preserve the complete plan.`);
    const text = paragraphs.join("\n\n");
    const view = render(<PlanContent text={text} complete />);
    const toggle = view.getByRole("button", { name: t("dialog.plan.title") });
    const body = view.getByRole("region", { name: t("dialog.plan.body") });
    expect(Array.from(body.querySelectorAll("p"), (p) => p.textContent)).toEqual(paragraphs);
    expect(body).not.toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(view.queryByRole("region")).toBeNull());
    view.rerender(<PlanContent text={text} complete />);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(Array.from(view.getByRole("region").querySelectorAll("p"), (p) => p.textContent)).toEqual(paragraphs);
  });

  it("renders Markdown while keeping agent markup literal", () => {
    const view = render(<PlanContent text={'# Review\n\n- First step\n- Second step\n\n<script>alert("plan")</script>'} complete />);
    expect(view.getByText("Review", { exact: true })).toBeVisible();
    expect(view.getByRole("list")).toHaveTextContent("First step");
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.getByText('<script>alert("plan")</script>')).toBeVisible();
    expect(view.queryByText(t("dialog.plan.partial"))).toBeNull();
  });

  it("identifies a clipped terminal fallback instead of calling it a full plan", () => {
    const view = render(<PlanContent text="Only the final paragraph is visible." complete={false} />);
    expect(view.getByText(t("dialog.plan.partial"))).toBeVisible();
    view.rerender(<PlanContent text="# Complete plan" complete />);
    expect(view.queryByText(t("dialog.plan.partial"))).toBeNull();
  });
});
