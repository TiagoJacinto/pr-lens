# PR Lens canvas

A Cloudflare Worker and static Pages asset bundle that preserves the PR Lens canvas interaction model and adds source-backed unit links.

## Free deployment

1. Create a Cloudflare D1 database named `pr-lens-canvas`.
2. Put its id in `wrangler.jsonc` and run `pnpm exec wrangler d1 migrations apply pr-lens-canvas --remote`.
3. Set the publish secret:

   ```bash
   pnpm exec wrangler secret put CANVAS_PUBLISH_TOKEN
   ```

4. Deploy:

   ```bash
   pnpm deploy
   ```

5. Add the deployed URL as the repository variable `PR_LENS_CANVAS_URL` and the same publish token as the repository secret `PR_LENS_CANVAS_PUBLISH_TOKEN`.
6. Add the two optional Action inputs from `packages/action/README.md`.

The Worker accepts graphs only when their provenance repository owner matches `ALLOWED_REPOSITORY_OWNER` in `wrangler.jsonc`. Change that value before deploying a fork. The canvas URL is a read capability, so keep it in the PR comment rather than in an index or public directory.

The static SVG route remains available for embeds. The interactive route renders the same deterministic SVG and places accessible source links over every source-backed unit. Links use the analyzed pull-request head commit and GitHub's file-diff anchors; standalone documents use immutable blob links.
