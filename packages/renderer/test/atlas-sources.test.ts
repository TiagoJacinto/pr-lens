import { postmarkRefactorGraph } from "@coldtea/pr-lens-schema/examples";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.js";

describe("render atlas source metadata", () => {
  it("pairs architecture nodes and edges with their rendered ids", () => {
    const atlas = render(postmarkRefactorGraph, {
      lens: "architecture",
      theme: "light",
    }).atlas;
    expect(Object.keys(atlas.nodes).sort()).toEqual(
      Object.keys(atlas.sources.nodes).sort(),
    );
    expect(Object.keys(atlas.edges).sort()).toEqual(
      Object.keys(atlas.sources.edges).sort(),
    );
    for (const node of postmarkRefactorGraph.nodes)
      expect(atlas.sources.nodes[node.id]).toEqual(node.files);
    for (const edge of postmarkRefactorGraph.edges)
      expect(atlas.sources.edges[edge.id]).toEqual(edge.files);
  });

  it("pairs flow messages with their rendered ids", () => {
    const flow = postmarkRefactorGraph.flows[0];
    if (flow === undefined) throw new Error("fixture lost its flow");
    const atlas = render(postmarkRefactorGraph, {
      lens: "data-flow",
      theme: "light",
    }).atlas;
    expect(Object.keys(atlas.messages[flow.id] ?? {}).sort()).toEqual(
      Object.keys(atlas.sources.messages[flow.id] ?? {}).sort(),
    );
    for (const message of flow.messages)
      expect(atlas.sources.messages[flow.id]?.[message.id]).toEqual(
        message.files,
      );
  });
});
