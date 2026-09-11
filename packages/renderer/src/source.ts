import type { FileRef, GraphDoc } from "@coldtea/pr-lens-schema";

/**
 * Builds a stable GitHub source link from the revision captured during analysis.
 * Commit blob links are used deliberately: PR `files` anchors contain a
 * patch-specific hash that is not present in a graph document, while blob
 * links remain valid when the pull request receives later commits.
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
  const lines =
    file.startLine === undefined
      ? ""
      : `#L${file.startLine}${file.endLine === undefined ? "" : `-L${file.endLine}`}`;
  return `https://${host}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/blob/${encodeURIComponent(revision)}/${path}${lines}`;
};
