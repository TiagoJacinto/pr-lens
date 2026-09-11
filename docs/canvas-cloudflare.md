# Free private canvas deployment

The fork's compatible canvas runs on Cloudflare's free services:

- Pages assets serve the React canvas.
- A Worker serves the canvas API and SVG route.
- D1 stores one graph document per repository/pull request.

## One-time setup

1. Create a D1 database named `pr-lens-canvas`.
2. Set its id in `packages/canvas/wrangler.jsonc`.
3. Set `ALLOWED_REPOSITORY_OWNER` to the GitHub owner that may publish graphs.
4. Apply migrations and deploy from the repository root:

   ```bash
   cd packages/canvas
   pnpm exec wrangler d1 migrations apply pr-lens-canvas --remote
   pnpm deploy
   ```

5. Create the publish secret:

   ```bash
   pnpm exec wrangler secret put CANVAS_PUBLISH_TOKEN
   ```

6. Configure the Action in each allowed repository:

   - repository variable `PR_LENS_CANVAS_URL`: the Worker URL;
   - repository secret `PR_LENS_CANVAS_PUBLISH_TOKEN`: the same value as the Worker secret;
   - add both optional canvas inputs shown in `packages/action/README.md`.

The publish endpoint requires the service token and rejects graph provenance from other repository owners. The canvas view is an unlisted capability URL, matching PR Lens's existing canvas API. For private code that must not be exposed by a leaked URL, put the Worker behind Cloudflare Access with GitHub login and an allow policy for the maintainer account; the Action publish endpoint should remain available to the repository secret through a separate service-auth policy.
