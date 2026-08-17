import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariants } from "./badge";

describe("badgeVariants", () => {
  it("keeps every existing variant working when no tone is given", () => {
    expect(badgeVariants({ variant: "default" })).toContain("bg-primary");
    expect(badgeVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(badgeVariants({ variant: "destructive" })).toContain(
      "text-destructive",
    );
    expect(badgeVariants({ variant: "outline" })).toContain("border-border");
    expect(badgeVariants({ variant: "ghost" })).toContain("hover:bg-muted");
    expect(badgeVariants({ variant: "link" })).toContain("hover:underline");
    // No tone => no semantic classes leak in.
    for (const token of ["success", "warning", "info", "neutral"]) {
      expect(badgeVariants({ variant: "default" })).not.toContain(
        `text-${token}`,
      );
    }
  });

  it("emits the semantic token classes for each tone", () => {
    for (const tone of ["success", "warning", "info", "neutral"] as const) {
      const cls = badgeVariants({ tone });
      expect(cls).toContain(`bg-${tone}/12`);
      expect(cls).toContain(`text-${tone}`);
      expect(cls).toContain(`border-${tone}/25`);
    }
  });

  it("orders tone after variant so tailwind-merge lets tone win the fill", () => {
    const cls = badgeVariants({ variant: "default", tone: "success" });
    expect(cls.indexOf("bg-primary")).toBeLessThan(cls.indexOf("bg-success/12"));
    expect(cls.indexOf("text-primary-foreground")).toBeLessThan(
      cls.indexOf("text-success"),
    );
  });

  it("keeps outline unfilled when toned", () => {
    expect(badgeVariants({ variant: "outline", tone: "warning" })).toContain(
      "bg-transparent",
    );
  });
});

describe("<Badge>", () => {
  it("lets tone survive tailwind-merge against the default variant", () => {
    const html = renderToStaticMarkup(<Badge tone="success">ok</Badge>);
    expect(html).toContain("bg-success/12");
    expect(html).toContain("text-success");
    expect(html).not.toContain("bg-primary");
    expect(html).not.toContain("text-primary-foreground");
  });

  it("is unchanged when no tone is passed", () => {
    const html = renderToStaticMarkup(<Badge>plain</Badge>);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
    expect(html).not.toContain("data-tone");
  });

  it("exposes the semantic on data-tone for tests and styling hooks", () => {
    expect(renderToStaticMarkup(<Badge tone="warning">w</Badge>)).toContain(
      'data-tone="warning"',
    );
  });
});
