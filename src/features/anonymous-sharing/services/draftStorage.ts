const draftKey = (id: string) => `ongi.sharing-draft.${id}`;
export function readDraft(id: string): Record<string, string> {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? 'null');
    if (draft?.expires > Date.now() && draft.answers && typeof draft.answers === 'object') {
      return Object.fromEntries(
        Object.entries(draft.answers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
    }
    sessionStorage.removeItem(draftKey(id));
  } catch {
    /* Storage may be unavailable. */
  }
  return {};
}
export function storeDraft(id: string, answers: Record<string, string>, expires: string) {
  try {
    sessionStorage.setItem(draftKey(id), JSON.stringify({ answers, expires: Date.parse(expires) }));
  } catch {
    /* Server saving remains available. */
  }
}
export function removeDraft(id: string) {
  try {
    sessionStorage.removeItem(draftKey(id));
  } catch {
    /* Storage may be unavailable. */
  }
}
