import type { GraphDoc } from "@coldtea/pr-lens-schema";
import { parseGraphDoc, SCHEMA_VERSION } from "@coldtea/pr-lens-schema";

/**
 * A flow that exercises every message kind together: waited-on calls with and
 * without an answering return, fire-and-forget steps into columns that are
 * both idle and mid-call, a self step, and returns — the shapes the message
 * kind semantics have to keep apart.
 */
export const mixedKindsGraph: GraphDoc = parseGraphDoc({
    schemaVersion: SCHEMA_VERSION,
    kind: "graph",
    title: "Placing an order",
    summary:
        "One checkout request fanning into waited-on and fire-and-forget work.",
    lenses: ["data-flow"],
    provenance: {
        repo: { owner: "coldteadotai", name: "pr-lens" },
        base: { sha: "1111111" },
        head: { sha: "2222222" },
    },
    lanes: [{ id: "services", label: "Services" }],
    nodes: [
        {
            id: "api",
            label: "checkout API",
            kind: "route",
            delta: "modified",
            lane: "services",
            files: [
                { path: "src/routes/checkout.ts", revision: "head" as const },
            ],
        },
        {
            id: "worker",
            label: "order worker",
            kind: "function",
            delta: "modified",
            lane: "services",
            files: [
                { path: "src/workers/order.ts", revision: "head" as const },
            ],
        },
        {
            id: "store",
            label: "order store",
            kind: "datastore",
            delta: "unchanged",
            lane: "services",
            files: [{ path: "test/fixture.ts", revision: "head" as const }],
        },
    ],
    flows: [
        {
            id: "checkout",
            title: "Placing an order",
            delta: "modified",
            participants: [
                { node: "api" },
                { node: "worker" },
                { node: "store" },
            ],
            messages: [
                {
                    id: "place-order",
                    from: "api",
                    to: "worker",
                    label: "place order",
                    kind: "sync",
                    delta: "modified",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "audit",
                    from: "worker",
                    to: "store",
                    label: "append audit event",
                    kind: "async",
                    delta: "added",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "validate",
                    from: "worker",
                    to: "worker",
                    label: "validate cart",
                    kind: "self",
                    delta: "unchanged",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "confirm",
                    from: "worker",
                    to: "api",
                    label: "order confirmed",
                    kind: "return",
                    delta: "modified",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "persist",
                    from: "api",
                    to: "store",
                    label: "persist receipt",
                    kind: "sync",
                    delta: "added",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "ack",
                    from: "store",
                    to: "api",
                    label: "receipt id",
                    kind: "return",
                    delta: "added",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "notify",
                    from: "api",
                    to: "worker",
                    label: "notify shipped",
                    kind: "async",
                    delta: "added",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
                {
                    id: "warm",
                    from: "api",
                    to: "store",
                    label: "warm cache",
                    kind: "sync",
                    delta: "unchanged",
                    files: [
                        { path: "test/fixture.ts", revision: "head" as const },
                    ],
                },
            ],
        },
    ],
});
