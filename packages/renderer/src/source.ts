import { sha256 } from "@noble/hashes/sha2.js";
import type { FileRef, GraphDoc } from "@coldtea/pr-lens-schema";

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const diffAnchor = (file: FileRef): string => {
  const side = file.revision === "base" ? "L" : "R";
  const line = file.startLine === undefined ? "" : `${side}${file.startLine}`;
  const endLine = file.endLine === undefined ? "" : `-L${file.endLine}`;
  return `diff-${hex(sha256(new TextEncoder().encode(file.path)))}${line}${endLine}`;
};

/**
 * Builds a stable GitHub source link from the revision captured during analysis.
 * Pull requests use their commit-pinned Files changed route; standalone graph
 * documents fall back to an immutable blob permalink.
 */
export const buildGithubPermalink = (doc: GraphDoc, file: FileRef): string => {
  const { repo } = doc.provenance;
  const revision =
    file.revision === "base"
      ? doc.provenance.base.sha
      : doc.provenance.head.sha;
  const path = file.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const host = repo.host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const pullRequest = doc.provenance.pullRequest;
  if (pullRequest !== undefined) {
    return `https://${host}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pull/${pullRequest.number}/files/${encodeURIComponent(doc.provenance.head.sha)}#${diffAnchor(file)}`;
  }

  const lines =
    file.startLine === undefined
      ? ""
      : `#L${file.startLine}${file.endLine === undefined ? "" : `-L${file.endLine}`}`;
  return `https://${host}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/blob/${encodeURIComponent(revision)}/${path}${lines}`;
};
