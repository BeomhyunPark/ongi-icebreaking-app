import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import packageJson from './package.json' with { type: 'json' };
import {
  getActivityDestination,
  SHARE_TARGETS,
  type ShareTarget,
} from './src/app/shareTargets.ts';

const SITE_URL = 'https://ongi.greengroove.app/';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createSharePage(target: ShareTarget): string {
  const shareUrl = new URL(`share/${target.slug}/`, SITE_URL).href;
  const destinationUrl = new URL(getActivityDestination(target.target), SITE_URL).href;
  const imageUrl = new URL(`images/share/${target.slug}-v1.png`, SITE_URL).href;

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${escapeHtml(target.accent)}" />
    <meta name="robots" content="noindex, follow" />
    <meta name="description" content="${escapeHtml(target.description)}" />
    <link rel="canonical" href="${escapeHtml(destinationUrl)}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="온기" />
    <meta property="og:title" content="${escapeHtml(target.title)}" />
    <meta property="og:description" content="${escapeHtml(target.description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(`${target.label} — 온기`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(target.title)}" />
    <meta name="twitter:description" content="${escapeHtml(target.description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(destinationUrl)}" />
    <title>${escapeHtml(target.title)}</title>
  </head>
  <body>
    <p><a href="${escapeHtml(destinationUrl)}">${escapeHtml(target.label)} 시작하기</a></p>
    <script>window.location.replace(${JSON.stringify(destinationUrl)});</script>
  </body>
</html>`;
}

function sharePagesPlugin(): Plugin {
  return {
    name: 'ongi-share-pages',
    generateBundle() {
      for (const target of SHARE_TARGETS) {
        this.emitFile({
          type: 'asset',
          fileName: `share/${target.slug}/index.html`,
          source: createSharePage(target),
        });
      }
    },
  };
}

export default defineConfig({
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react(), sharePagesPlugin()],
});
