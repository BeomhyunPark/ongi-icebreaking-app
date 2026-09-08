import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe('기능 경계', () => {
  it('활동은 다른 활동의 내부 구현을 가져오지 않는다', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(join(root, 'src/features'))) {
      const owner = relative(join(root, 'src/features'), file).split('/')[0];
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
        if (!match[1].startsWith('.')) continue;
        const target = relative(
          join(root, 'src/features'),
          normalize(join(dirname(file), match[1])),
        );
        if (!target.startsWith('..') && target.split('/')[0] !== owner) {
          violations.push(`${relative(root, file)} -> ${match[1]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('공통 UI와 플랫폼 서비스는 특정 활동의 내부를 참조하지 않는다', () => {
    const violations: string[] = [];
    for (const directory of ['src/components', 'src/platform']) {
      for (const file of sourceFiles(join(root, directory))) {
        for (const match of readFileSync(file, 'utf8').matchAll(
          /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g,
        )) {
          if (match[1].includes('/features/'))
            violations.push(`${relative(root, file)} -> ${match[1]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('계산과 상태 전이는 React 및 브라우저 저장소에 의존하지 않는다', () => {
    const violations = sourceFiles(join(root, 'src/features'))
      .filter((file) => /\/(domain|state)\//.test(file))
      .filter((file) =>
        /from ['"]react['"]|\b(?:window|document|localStorage|sessionStorage)\./.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => relative(root, file));
    expect(violations).toEqual([]);
  });
});
