import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  createProjectProfileCacheKey,
  readCachedProjectProfile,
  writeCachedProjectProfile,
} from '../src/project-profile-cache.js';

describe('project profile cache', () => {
  it('tracks the exact repository context and model used by profile generation', () => {
    const files = ['README.md', 'src/index.ts'];
    const context = [{ path: 'README.md', content: 'Project purpose' }];
    const key = createProjectProfileCacheKey('model-a', files, context);
    assert.equal(key, createProjectProfileCacheKey('model-a', files, context));
    assert.notEqual(key, createProjectProfileCacheKey('model-b', files, context));
    assert.notEqual(
      key,
      createProjectProfileCacheKey('model-a', [...files, 'src/new.ts'], context)
    );
    assert.notEqual(
      key,
      createProjectProfileCacheKey('model-a', files, [
        { path: 'README.md', content: 'Changed purpose' },
      ])
    );
  });

  it('only restores a nonempty profile with the exact key', () => {
    const cacheFile = join(
      mkdtempSync(join(tmpdir(), 'release-profile-')),
      'nested',
      'profile.json'
    );
    writeCachedProjectProfile(cacheFile, 'expected', 'project facts');
    assert.equal(readCachedProjectProfile(cacheFile, 'expected'), 'project facts');
    assert.equal(readCachedProjectProfile(cacheFile, 'different'), '');
    assert.match(readFileSync(cacheFile, 'utf8'), /project facts/);
  });
});
