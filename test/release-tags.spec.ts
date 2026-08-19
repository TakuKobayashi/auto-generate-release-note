import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isReleaseTag } from '../src/release-tags.js';

describe('isReleaseTag', () => {
  it('accepts stable and prerelease semantic-version tags', () => {
    for (const tag of ['v1.0.0', '1.2.3', 'v2.0.0-beta.1', '1.0.0-rc.2']) {
      assert.equal(isReleaseTag(tag), true, tag);
    }
  });

  it('rejects tags outside the supported format', () => {
    for (const tag of ['v1', '1.2', 'release-1.2.3', 'v1.2.3+build', 'latest']) {
      assert.equal(isReleaseTag(tag), false, tag);
    }
  });
});
