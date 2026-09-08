const SHARE_TITLE = '온기 | 우리 사이에 온기를';

export type ShareAppLinkResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export type ShareAppLinkOptions = {
  title?: string;
  url?: string;
};

function getShareUrl(): string {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ?? window.location.href;
}

export function buildActivityShareUrl(slug: string): string {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const siteBaseUrl = new URL(canonical ?? './', window.location.href);

  return new URL(`share/${slug}/`, siteBaseUrl).href;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Copy command failed');
  }
}

function isShareCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

async function copyShareUrl(): Promise<ShareAppLinkResult> {
  try {
    await copyText(getShareUrl());
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function shareAppLink(
  options: ShareAppLinkOptions = {},
): Promise<ShareAppLinkResult> {
  const url = options.url ?? getShareUrl();

  if (typeof navigator.share !== 'function') {
    try {
      await copyText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  try {
    await navigator.share({
      title: options.title ?? SHARE_TITLE,
      url,
    });
    return 'shared';
  } catch (error: unknown) {
    if (isShareCancellation(error)) {
      return 'cancelled';
    }

    if (options.url) {
      try {
        await copyText(url);
        return 'copied';
      } catch {
        return 'failed';
      }
    }

    return copyShareUrl();
  }
}
