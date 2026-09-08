/** Storage may be unavailable or contain data from an older app version. */
export function readStoredValue(key: string): unknown {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A storage restriction must not interrupt the current activity.
  }
}
