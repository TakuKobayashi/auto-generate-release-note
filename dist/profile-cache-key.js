// src/profile-cache-key.ts
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// src/analysis-plan.ts
var projectContextNames = /* @__PURE__ */ new Set([
  "README.md",
  "README-ja.md",
  "package.json",
  "pnpm-workspace.yaml",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "settings.gradle",
  "settings.gradle.kts",
  "build.gradle",
  "build.gradle.kts",
  "ProjectSettings/ProjectVersion.txt",
  "Packages/manifest.json"
]);
function selectProjectContextFiles(paths) {
  return paths.filter((filePath) => {
    const normalized = filePath.replaceAll("\\", "/");
    const fileName = normalized.split("/").at(-1) || "";
    return projectContextNames.has(normalized) || projectContextNames.has(fileName) || /(^|\/)README(?:-[^/]+)?\.md$/i.test(normalized);
  });
}

// src/project-profile-cache.ts
import { createHash } from "node:crypto";
var projectProfileSchema = "project-profile-v1";
function createProjectProfileCacheKey(model2, repositoryFiles2, contextFiles2) {
  return createHash("sha256").update(
    JSON.stringify({
      schema: projectProfileSchema,
      model: model2,
      repositoryFiles: repositoryFiles2,
      contextFiles: contextFiles2
    })
  ).digest("hex");
}

// src/profile-cache-key.ts
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).trim();
}
function resolveGitRef(ref) {
  for (const candidate of [ref, `origin/${ref}`]) {
    try {
      return git("rev-parse", "--verify", `${candidate}^{commit}`);
    } catch {
    }
  }
  throw new Error(`Git comparison ref does not resolve to a commit: ${ref}`);
}
var target = process.env.INPUT_COMPARISON_TARGET || process.env.INPUT_TAG || "HEAD";
var model = process.env.INPUT_MODEL || "qwen2.5-coder:7b-instruct";
var resolvedTarget = resolveGitRef(target);
var repositoryFiles = git("ls-tree", "-r", "--name-only", resolvedTarget).split("\n").filter(Boolean);
var contextFiles = selectProjectContextFiles(repositoryFiles).map((path) => ({
  path,
  content: git("show", `${resolvedTarget}:${path}`)
}));
var key = createProjectProfileCacheKey(model, repositoryFiles, contextFiles);
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
appendFileSync(process.env.GITHUB_OUTPUT, `key=${key}
`);
console.log(`Project profile cache key: ${key}`);
