import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { helpText, parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('parses value and boolean options', () => {
    assert.deepEqual(
      parseArgs([
        '--tag',
        'HEAD',
        '--release-name',
        'v1.2.3',
        '--template-file',
        '.github/PULL_REQUEST_TEMPLATE/release.md',
        '--analysis-concurrency',
        '4',
        '--comparison-base',
        'production',
        '--comparison-target',
        'feature/release',
        '--language=ja',
        '--dry-run',
        '--bilingual=false',
      ]),
      {
        tag: 'HEAD',
        'release-name': 'v1.2.3',
        'template-file': '.github/PULL_REQUEST_TEMPLATE/release.md',
        'analysis-concurrency': '4',
        'comparison-base': 'production',
        'comparison-target': 'feature/release',
        language: 'ja',
        'dry-run': true,
        bilingual: false,
      }
    );
  });

  it('rejects unknown options', () => {
    assert.throws(() => parseArgs(['--unknown']), /Unknown option/);
  });

  it('rejects a missing value', () => {
    assert.throws(() => parseArgs(['--model']), /requires a value/);
  });

  it('rejects invalid boolean values', () => {
    assert.throws(() => parseArgs(['--dry-run=yes']), /must be true or false/);
  });

  it('recognizes help without exiting the process', () => {
    assert.equal(parseArgs(['--help']).help, true);
    assert.match(helpText, /Usage: node dist\/index\.js/);
  });
});
