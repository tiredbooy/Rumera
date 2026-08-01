import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "./permissions";
import { isStaff, permissionsForRole, ROLE_PERMISSIONS } from "./roles";

describe("admin role semantics", () => {
  it("admits only admin to the admin surface", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("customer")).toBe(false);
    expect(isStaff("vendor")).toBe(false);
    expect(isStaff("manager")).toBe(false);
    expect(isStaff("support")).toBe(false);
    expect(isStaff("operator")).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });

  it("gives every frontend capability to admin and none to other roles", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(Object.values(PERMISSIONS));
    expect(permissionsForRole("customer")).toEqual([]);
    expect(permissionsForRole("vendor")).toEqual([]);
    expect(permissionsForRole("manager")).toEqual([]);
    expect(permissionsForRole("support")).toEqual([]);
    expect(permissionsForRole("operator")).toEqual([]);
  });
});
