/** True only while `next build` is prerendering. Not set in `next start` or dev. */
export function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
