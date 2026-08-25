import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Increment this when project-profile selection or prompting semantics change.
export const projectProfileSchema = 'project-profile-v1';

export type ProjectContextFile = { path: string; content: string };

export function createProjectProfileCacheKey(
  model: string,
  repositoryFiles: string[],
  contextFiles: ProjectContextFile[]
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schema: projectProfileSchema,
        model,
        repositoryFiles,
        contextFiles,
      })
    )
    .digest('hex');
}

export function readCachedProjectProfile(cacheFile: string, expectedKey: string) {
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.key === expectedKey && typeof cached.profile === 'string' && cached.profile.trim()) {
      return cached.profile as string;
    }
  } catch {}
  return '';
}

export function writeCachedProjectProfile(cacheFile: string, key: string, profile: string) {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify({ key, profile })}\n`);
}
