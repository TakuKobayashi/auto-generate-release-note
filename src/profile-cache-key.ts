import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { selectProjectContextFiles } from './analysis-plan.js';
import { createProjectProfileCacheKey } from './project-profile-cache.js';

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
}

function resolveGitRef(ref: string) {
  for (const candidate of [ref, `origin/${ref}`]) {
    try {
      return git('rev-parse', '--verify', `${candidate}^{commit}`);
    } catch {}
  }
  throw new Error(`Git comparison ref does not resolve to a commit: ${ref}`);
}

const target = process.env.INPUT_COMPARISON_TARGET || process.env.INPUT_TAG || 'HEAD';
const model = process.env.INPUT_MODEL || 'qwen2.5-coder:7b-instruct';
const resolvedTarget = resolveGitRef(target);
const repositoryFiles = git('ls-tree', '-r', '--name-only', resolvedTarget)
  .split('\n')
  .filter(Boolean);
const contextFiles = selectProjectContextFiles(repositoryFiles).map((path) => ({
  path,
  content: git('show', `${resolvedTarget}:${path}`),
}));
const key = createProjectProfileCacheKey(model, repositoryFiles, contextFiles);

if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
appendFileSync(process.env.GITHUB_OUTPUT, `key=${key}\n`);
console.log(`Project profile cache key: ${key}`);
