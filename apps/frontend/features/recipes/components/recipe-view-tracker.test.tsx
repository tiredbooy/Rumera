// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  status: "authenticated" as "authenticated" | "unauthenticated",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));

vi.mock("@/features/recommendations/hooks", () => ({
  useRecordInteraction: () => ({
    mutateAsync: mocks.mutateAsync,
  }),
}));

import { RecipeViewTracker } from "./recipe-view-tracker";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "authenticated";
  mocks.mutateAsync.mockResolvedValue(undefined);
});

describe("RecipeViewTracker", () => {
  it("records recipe_view once per linked product when authenticated", async () => {
    render(
      <RecipeViewTracker recipeId={9} productIds={[4, 4, 7, 0, -1]} />,
    );

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      product_id: 4,
      interaction_type: "recipe_view",
      source: "recipe_detail",
      metadata: { recipe_id: 9 },
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      product_id: 7,
      interaction_type: "recipe_view",
      source: "recipe_detail",
      metadata: { recipe_id: 9 },
    });
  });

  it("does nothing for guests", async () => {
    mocks.status = "unauthenticated";
    render(<RecipeViewTracker recipeId={9} productIds={[4]} />);
    await waitFor(() => {
      expect(mocks.mutateAsync).not.toHaveBeenCalled();
    });
  });
});
