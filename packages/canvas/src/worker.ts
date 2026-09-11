import { render } from "@coldtea/pr-lens-renderer";
import { safeParseGraphDoc } from "@coldtea/pr-lens-schema";

type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
  ALLOWED_REPOSITORY_OWNER: string;
  CANVAS_PUBLISH_TOKEN: string;
};

type CanvasRow = {
  id: string;
  write_token_hash: string;
  revision: number;
  graph: string | null;
  repository: string | null;
  pull_request: number | null;
};

const TOKEN_LENGTH = 22;
const MAX_GRAPH_BYTES = 4_000_000;

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const refusal = (
  code: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
): Response => json({ error: { code, message, ...extra } }, status);

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const token = (): string => base64Url(crypto.getRandomValues(new Uint8Array(16)));

const tokenHash = async (value: string): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const bearerToken = (request: Request): string | undefined => {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
};

const matches = async (candidate: string | undefined, expectedHash: string): Promise<boolean> => {
  if (candidate === undefined) return false;
  const candidateHash = await tokenHash(candidate);
  if (candidateHash.length !== expectedHash.length) return false;

  let difference = 0;
  for (let index = 0; index < candidateHash.length; index += 1)
    difference |= candidateHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0;
};

const canvasUrls = (request: Request, id: string, writeToken?: string) => {
  const origin = new URL(request.url).origin;
  const viewUrl = `${origin}/c/${id}`;
  return {
    viewUrl,
    ...(writeToken === undefined ? {} : { editUrl: `${viewUrl}#w=${writeToken}` }),
    embedUrl: `${viewUrl}.svg`,
  };
};

const readCanvas = async (db: D1Database, id: string): Promise<CanvasRow | undefined> =>
  (await db
    .prepare("SELECT id, write_token_hash, revision, graph FROM canvases WHERE id = ?")
    .bind(id)
    .first<CanvasRow>()) ?? undefined;

const parseIfMatch = (request: Request): number | undefined => {
  const raw = request.headers.get("if-match")?.replaceAll('"', "").trim();
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
};

const parseBody = async (request: Request): Promise<unknown | undefined> => {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_GRAPH_BYTES) return undefined;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_GRAPH_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const canvasId = (pathname: string): string | undefined => {
  const match = /^\/api\/canvas\/([A-Za-z0-9_-]{22})(?:\/rotate)?$/.exec(pathname);
  return match?.[1];
};

const handleApi = async (request: Request, env: Bindings): Promise<Response> => {
  const url = new URL(request.url);
  if (url.pathname === "/api/canvas/pr" && request.method === "POST") {
    if (!(await matches(bearerToken(request), await tokenHash(env.CANVAS_PUBLISH_TOKEN))))
      return refusal("NOT_FOUND", "No such canvas", 404);

    const body = await parseBody(request);
    if (typeof body !== "object" || body === null || !("repository" in body) || !("pullRequest" in body))
      return refusal("INVALID_REQUEST", "repository and pullRequest are required", 400);
    const repository = body.repository;
    const pullRequest = body.pullRequest;
    if (
      typeof repository !== "string" ||
      !/^[^/]+\/[^/]+$/.test(repository) ||
      typeof pullRequest !== "number" ||
      !Number.isInteger(pullRequest) ||
      pullRequest < 1 ||
      repository.split("/", 1)[0] !== env.ALLOWED_REPOSITORY_OWNER
    )
      return refusal("NOT_FOUND", "No such canvas", 404);

    const existing = await env.DB.prepare(
      "SELECT id, write_token_hash, revision, graph, repository, pull_request FROM canvases WHERE repository = ? AND pull_request = ?",
    )
      .bind(repository, pullRequest)
      .first<CanvasRow>();
    const writeToken = token();
    const now = new Date().toISOString();
    if (existing === null) {
      const id = token();
      await env.DB.prepare(
        "INSERT INTO canvases (id, write_token_hash, revision, graph, repository, pull_request, created_at, updated_at) VALUES (?, ?, 0, NULL, ?, ?, ?, ?)",
      )
        .bind(id, await tokenHash(writeToken), repository, pullRequest, now, now)
        .run();
      return json({ id, writeToken, rev: 0, ...canvasUrls(request, id, writeToken) }, 201);
    }

    await env.DB.prepare("UPDATE canvases SET write_token_hash = ?, updated_at = ? WHERE id = ?")
      .bind(await tokenHash(writeToken), now, existing.id)
      .run();
    return json({ id: existing.id, writeToken, rev: existing.revision, ...canvasUrls(request, existing.id, writeToken) });
  }

  if (url.pathname === "/api/canvas" && request.method === "POST") {
    const id = token();
    const writeToken = token();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO canvases (id, write_token_hash, revision, graph, created_at, updated_at) VALUES (?, ?, 0, NULL, ?, ?)",
    )
      .bind(id, await tokenHash(writeToken), now, now)
      .run();
    return json({ id, writeToken, rev: 0, ...canvasUrls(request, id, writeToken) }, 201);
  }

  const id = canvasId(url.pathname);
  if (id === undefined) return refusal("NOT_FOUND", "No such canvas", 404);
  const canvas = await readCanvas(env.DB, id);
  if (canvas === undefined) return refusal("NOT_FOUND", "No such canvas", 404);

  if (request.method === "GET") {
    if (canvas.graph === null) return refusal("NOT_FOUND", "No published canvas", 404);
    return json({
      id,
      rev: canvas.revision,
      ...canvasUrls(request, id),
      document: JSON.parse(canvas.graph),
      tiles: [],
    });
  }

  if (request.method === "PUT") {
    const revision = parseIfMatch(request);
    if (revision === undefined)
      return refusal("INVALID_REQUEST", "If-Match must carry the current canvas revision", 400);

    const body = await parseBody(request);
    if (body === undefined)
      return refusal("INVALID_REQUEST", "The canvas document must be JSON and at most 4 MB", 400);

    if (!(await matches(bearerToken(request), canvas.write_token_hash)))
      return refusal("NOT_FOUND", "No such canvas", 404);
    if (revision !== canvas.revision)
      return refusal("REVISION_MOVED", "The canvas has moved on since you pulled it; pull again, then push", 409, {
        rev: canvas.revision,
      });

    const parsed = safeParseGraphDoc(body);
    if (!parsed.ok)
      return refusal("INVALID_DOCUMENT", "The canvas document does not match the PR Lens contract", 422, {
        issues: parsed.error.issues,
      });

    if (parsed.value.provenance.repo.owner !== env.ALLOWED_REPOSITORY_OWNER)
      return refusal("NOT_FOUND", "No such canvas", 404);

    const nextRevision = canvas.revision + 1;
    await env.DB.prepare("UPDATE canvases SET revision = ?, graph = ?, updated_at = ? WHERE id = ?")
      .bind(nextRevision, JSON.stringify(parsed.value), new Date().toISOString(), id)
      .run();
    return json({ id, rev: nextRevision, ...canvasUrls(request, id, bearerToken(request)), tiles: [] });
  }

  if (url.pathname.endsWith("/rotate") && request.method === "POST") {
    const body = await parseBody(request);
    if (
      typeof body !== "object" ||
      body === null ||
      !("writeToken" in body) ||
      typeof body.writeToken !== "string" ||
      !new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`).test(body.writeToken)
    )
      return refusal("INVALID_REQUEST", "writeToken must be a 22-character base64url token", 400);

    const nextTokenHash = await tokenHash(body.writeToken);
    if (!(await matches(body.writeToken, canvas.write_token_hash))) {
      if (!(await matches(bearerToken(request), canvas.write_token_hash)))
        return refusal("NOT_FOUND", "No such canvas", 404);
      await env.DB.prepare("UPDATE canvases SET write_token_hash = ?, updated_at = ? WHERE id = ?")
        .bind(nextTokenHash, new Date().toISOString(), id)
        .run();
    }
    return json({ id, ...canvasUrls(request, id, body.writeToken) });
  }

  if (request.method === "DELETE") {
    if (!(await matches(bearerToken(request), canvas.write_token_hash)))
      return refusal("NOT_FOUND", "No such canvas", 404);
    await env.DB.prepare("DELETE FROM canvases WHERE id = ?").bind(id).run();
    return json({ id, deleted: true });
  }

  return refusal("NOT_FOUND", "No such canvas", 404);
};

const canvasPageId = (pathname: string): string | undefined =>
  /^\/c\/([A-Za-z0-9_-]{22})(?:\.svg)?$/.exec(pathname)?.[1];

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    const id = canvasPageId(url.pathname);
    if (id !== undefined && url.pathname.endsWith(".svg")) {
      const canvas = await readCanvas(env.DB, id);
      if (canvas?.graph === null || canvas === undefined) return new Response("Not found", { status: 404 });
      const parsed = safeParseGraphDoc(JSON.parse(canvas.graph));
      if (!parsed.ok) return new Response("Invalid graph", { status: 422 });
      return new Response(render(parsed.value, { lens: "architecture", theme: "light" }).svg, {
        headers: { "content-type": "image/svg+xml; charset=utf-8" },
      });
    }

    if (id !== undefined) return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Bindings>;
