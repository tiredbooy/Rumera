export type RecommendationOpsStats = {
  window_days: number;
  interaction_total: number;
  unique_users: number;
  profiles_total: number;
  interactions_by_type: Record<string, number>;
  generated_at: string;
};
