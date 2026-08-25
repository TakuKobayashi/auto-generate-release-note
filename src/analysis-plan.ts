import { extname } from 'node:path';

const metadataOnlyNames = new Set([
  'package-lock.json',
  'packages-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
  'poetry.lock',
]);
const metadataOnlyExtensions = new Set(['.asset', '.meta', '.prefab', '.unity', '.uss', '.uxml']);
const projectContextNames = new Set([
  'README.md',
  'README-ja.md',
  'package.json',
  'pnpm-workspace.yaml',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'pom.xml',
  'settings.gradle',
  'settings.gradle.kts',
  'build.gradle',
  'build.gradle.kts',
  'ProjectSettings/ProjectVersion.txt',
  'Packages/manifest.json',
]);

export function shouldAnalyzeAsMetadata(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/');
  const fileName = normalized.split('/').at(-1)?.toLowerCase() || '';
  return (
    metadataOnlyNames.has(fileName) ||
    metadataOnlyExtensions.has(extname(fileName).toLowerCase()) ||
    /(^|\/)(dist|build|generated|vendor)(\/|$)/i.test(normalized) ||
    /\.(min\.(js|css)|snap)$/i.test(normalized)
  );
}

export function selectRelevantContextFiles(paths: string[], changedPaths: string[]) {
  return paths.filter((filePath) => {
    const normalized = filePath.replaceAll('\\', '/');
    const fileName = normalized.split('/').at(-1) || '';
    const isContextFile =
      projectContextNames.has(normalized) ||
      projectContextNames.has(fileName) ||
      /(^|\/)README(?:-[^/]+)?\.md$/i.test(normalized);
    if (!isContextFile || changedPaths.includes(normalized)) return false;

    const directory = normalized.includes('/')
      ? normalized.slice(0, normalized.lastIndexOf('/'))
      : '';
    return (
      !directory || changedPaths.some((changedPath) => changedPath.startsWith(`${directory}/`))
    );
  });
}

export function splitEvidence(evidence: string) {
  const lines = evidence.split('\n');
  if (lines.length < 2) {
    const middle = Math.ceil(evidence.length / 2);
    return [evidence.slice(0, middle), evidence.slice(middle)].filter(Boolean);
  }
  const middle = Math.ceil(lines.length / 2);
  return [lines.slice(0, middle).join('\n'), lines.slice(middle).join('\n')].filter(Boolean);
}

export function outputTokenBudget(stage: string) {
  if (stage.startsWith('final-release-notes-template')) return 4096;
  if (stage.startsWith('final-release-notes')) return 2048;
  if (stage.startsWith('evidence-selection') || stage.startsWith('capacity-analysis')) return 1024;
  return 768;
}
