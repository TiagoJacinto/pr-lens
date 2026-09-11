import { describe, expect, it } from "vitest";
import { buildGithubPermalink } from "../src/index.js";
import { postmarkRefactorGraph } from "@coldtea/pr-lens-schema/examples";

describe("buildGithubPermalink", () => {
  const doc = {
    ...postmarkRefactorGraph,
    provenance: {
      ...postmarkRefactorGraph.provenance,
      repo: { owner: "cold tea", name: "pr lens", host: "github.com" },
      base: { sha: "b".repeat(40) },
      head: { sha: "a".repeat(40) },
    },
  };

  it("uses the captured head and base revisions", () => {
    expect(
      buildGithubPermalink(doc, { path: "src/app.ts", revision: "head" }),
    ).toContain(`/blob/${"a".repeat(40)}/src/app.ts`);
    expect(
      buildGithubPermalink(doc, { path: "src/app.ts", revision: "base" }),
    ).toContain(`/blob/${"b".repeat(40)}/src/app.ts`);
  });

  it("builds single-line and line-range anchors", () => {
    expect(
      buildGithubPermalink(doc, {
        path: "src/app.ts",
        startLine: 7,
        revision: "head",
      }),
    ).toMatch(/#L7$/);
    expect(
      buildGithubPermalink(doc, {
        path: "src/app.ts",
        startLine: 7,
        endLine: 11,
        revision: "head",
      }),
    ).toMatch(/#L7-L11$/);
  });

  it("encodes repository components and path segments", () => {
    expect(
      buildGithubPermalink(doc, {
        path: "src/hello world.ts",
        revision: "head",
      }),
    ).toBe(
      `https://github.com/cold%20tea/pr%20lens/blob/${"a".repeat(40)}/src/hello%20world.ts`,
    );
  });

  it("stays on the captured commit when the PR receives later pushes", () => {
    const before = buildGithubPermalink(doc, {
      path: "src/app.ts",
      revision: "head",
    });
    const after = buildGithubPermalink(
      {
        ...doc,
        provenance: { ...doc.provenance, head: { sha: "a".repeat(40) } },
      },
      { path: "src/app.ts", revision: "head" },
    );
    expect(after).toBe(before);
  });
});
