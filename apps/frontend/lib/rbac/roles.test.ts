import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "./permissions";
import { isStaff, permissionsForRole, ROLE_PERMISSIONS } from "./roles";

describe("admin role semantics", () => {
  it("admits admin and staff to the panel surface", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("staff")).toBe(true);
    expect(isStaff("customer")).toBe(false);
    expect(isStaff("vendor")).toBe(false);
    expect(isStaff("manager")).toBe(false);
    expect(isStaff("support")).toBe(false);
    expect(isStaff("operator")).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });

  it("gives every frontend capability to admin and a seeded package to staff", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(Object.values(PERMISSIONS));
    expect(permissionsForRole("customer")).toEqual([]);
    expect(permissionsForRole("vendor")).toEqual([]);
    expect(permissionsForRole("manager")).toEqual([]);
    expect(permissionsForRole("support")).toEqual([]);
    expect(permissionsForRole("operator")).toEqual([]);
    expect(permissionsForRole("admin")).toEqual(Object.values(PERMISSIONS));
    expect(permissionsForRole("staff")).toContain(PERMISSIONS.PRODUCTS_READ);
    expect(permissionsForRole("staff")).not.toContain(PERMISSIONS.ROLES_MANAGE);
    expect(permissionsForRole("staff")).not.toContain(
      PERMISSIONS.SETTINGS_MANAGE,
    );
  });
});
