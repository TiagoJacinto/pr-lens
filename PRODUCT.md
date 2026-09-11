# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The initial user is the repository owner and their reviewers, inspecting pull requests through PR Lens.

## Product Purpose

PR Lens turns a pull-request change into an architecture and data-flow canvas. The fork preserves PR Lens behavior while making every rendered unit traceable to the exact source revision that produced it.

## Positioning

Every diagram unit is source-backed and opens the matching GitHub pull-request diff or immutable commit view instead of leaving the reviewer to translate an abstract diagram back into code.

## Operating Context

The canvas is opened from a pull-request comment. The initial deployment serves repositories owned by the project maintainer and stores graph documents durably in Cloudflare infrastructure.

## Capabilities and Constraints

The canvas retains PR Lens architecture views, data-flow views, drill-downs, themes, and source-backed graph rendering. GitHub links must remain pinned to the analyzed revision. Initial hosting uses free Cloudflare Pages/Workers/D1/R2-compatible infrastructure. The hosted canvas source is being recreated because it is not included in the upstream open-source repository.

## Brand Commitments

Preserve PR Lens's existing visual grammar, terminology, diagram renderer, and interaction model rather than inventing a replacement product.

## Evidence on Hand

The upstream PR Lens repository, its renderer, schema, canvas API contract, and the reference PR Lens canvas are available in this fork and its documentation.

## Product Principles

- Preserve upstream PR Lens behavior unless the source-navigation requirement demands a change.
- Make source traceability explicit and stable.
- Prefer deterministic rendering and immutable revision links.
- Keep the initial deployment private to the maintainer's repositories.
