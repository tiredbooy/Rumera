import type { RecommendationQuery } from "./types";

export const recommendationKeys = {
  forYouAll: ["recommendations", "for-you"] as const,
  forYou: (query: RecommendationQuery = {}) =>
    ["recommendations", "for-you", query] as const,
  profile: ["recommendations", "profile"] as const,
};
