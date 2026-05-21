/**
 * Regex that identifies legacy task/phase title codes.
 *
 * Matches patterns such as:
 *   [CF-GDB-03b-7] …
 *   CF-17R — …
 *   [W4-06] …
 *   audit-01: …
 */
export const LEGACY_TITLE_REGEX = /^\[?([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)\]?\s*(?:—|-|:)?\s*/;


/**
 * Returns a warning string if `title` looks like a legacy code pattern,
 * or null if the title is compliant with the "Area — description" convention.
 */
export function checkLegacyTitle(title: string): string | null {

  if (LEGACY_TITLE_REGEX.test(title)) {
    return (
      `Title looks like a legacy code ("${title}"). ` +
      'Prefer the format "Area — description" (e.g. "Atlas — Gruppi di dominio (CRUD)"). ' +
      'See docs/task-naming-convention.md'
    );
  }

  return null;
}
