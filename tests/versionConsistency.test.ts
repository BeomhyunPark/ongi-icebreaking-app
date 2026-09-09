import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { RELEASES } from '../src/features/updates/releaseHistory';

type PackageFile = {
  version: string;
};

type PackageLockFile = {
  version: string;
  packages: Record<string, { version?: string }>;
};

function readWorkspaceFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('제품 버전 관리', () => {
  it('프론트엔드, 백엔드, 잠금 파일과 업데이트 기록의 현재 버전이 일치한다', () => {
    const packageFile = JSON.parse(readWorkspaceFile('package.json')) as PackageFile;
    const packageLock = JSON.parse(readWorkspaceFile('package-lock.json')) as PackageLockFile;
    const backendBuild = readWorkspaceFile('backend/build.gradle');
    const changelog = readWorkspaceFile('CHANGELOG.md');
    const currentReleases = RELEASES.filter(({ current }) => current);
    const expectedVersion = `v${packageFile.version}`;

    expect(packageFile.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageLock.version).toBe(packageFile.version);
    expect(packageLock.packages['']?.version).toBe(packageFile.version);
    expect(backendBuild).toContain(`version = '${packageFile.version}'`);
    expect(readWorkspaceFile('public/sw.js')).toContain(`ongi-shell-v${packageFile.version}`);
    expect(currentReleases).toHaveLength(1);
    expect(RELEASES[0]).toBe(currentReleases[0]);
    expect(RELEASES[0].version).toBe(expectedVersion);
    expect(changelog).toContain(`## ${expectedVersion} ·`);
  });

  it('업데이트 기록의 버전은 중복되지 않고 최신순으로 정렬된다', () => {
    const versions = RELEASES.map(({ version }) => version);
    const numericVersions = versions.map((version) => (
      version.slice(1).split('.').reduce((value, part) => (value * 1_000) + Number(part), 0)
    ));

    expect(new Set(versions).size).toBe(versions.length);
    expect(numericVersions).toEqual([...numericVersions].sort((a, b) => b - a));
  });
});
