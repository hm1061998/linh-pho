import type { ContentIssue } from './types';
import { error, isNonEmptyString, isRecord, parseAll, readList } from './validateGameplay';

/**
 * The asset manifest: which optional models exist and where they come from. A missing or broken entry is dropped with
 * a reason, and the game still runs, because every asset has a fallback in code.
 */

/** Generated models are built in code by the engine. This list must match the engine's table of generators. */
export const KNOWN_GENERATORS: readonly string[] = ['crate'];

export type AssetSourceDef =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'generated'; readonly generator: string };

export interface AssetManifestEntry {
  readonly id: string;
  /** Null means the model is not made yet, so the fallback is used. */
  readonly source: AssetSourceDef | null;
  readonly idleAnimation: string | null;
}

export interface ValidatedAssets {
  readonly entries: readonly AssetManifestEntry[];
  readonly issues: ContentIssue[];
}

function parseSource(raw: unknown, where: string, issues: ContentIssue[]): AssetSourceDef | null | undefined {
  if (raw === null) {
    return null;
  }
  if (!isRecord(raw)) {
    issues.push(error(where, '"source" must be null, or an object with "kind"'));
    return undefined;
  }
  if (raw.kind === 'url') {
    // Same-origin paths only: a manifest must not point the game at someone else's server.
    if (typeof raw.url !== 'string' || !raw.url.startsWith('/assets/') || !raw.url.endsWith('.glb')) {
      issues.push(error(where, '"url" must be a path starting with /assets/ and ending with .glb'));
      return undefined;
    }
    return { kind: 'url', url: raw.url };
  }
  if (raw.kind === 'generated') {
    if (typeof raw.generator !== 'string' || !KNOWN_GENERATORS.includes(raw.generator)) {
      issues.push(error(where, `"generator" must be one of: ${KNOWN_GENERATORS.join(', ')}`));
      return undefined;
    }
    return { kind: 'generated', generator: raw.generator };
  }
  issues.push(error(where, '"kind" must be "url" or "generated"'));
  return undefined;
}

function parseEntry(raw: unknown, source: string, issues: ContentIssue[]): AssetManifestEntry | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `assets.${raw.id}`;
  const before = issues.length;
  if (raw.idleAnimation !== null && !isNonEmptyString(raw.idleAnimation)) {
    issues.push(error(where, '"idleAnimation" must be a non-empty name, or null'));
  }
  const sourceDef = parseSource(raw.source, where, issues);
  if (issues.length > before || sourceDef === undefined) {
    return null;
  }
  return { id: raw.id, source: sourceDef, idleAnimation: raw.idleAnimation === null ? null : (raw.idleAnimation as string) };
}

export function validateAssets(raw: unknown): ValidatedAssets {
  const issues: ContentIssue[] = [];
  const entries = parseAll(
    readList(raw, 'assets', issues),
    'assets',
    (entry, source, local) => parseEntry(entry, source, local),
    issues,
  );
  return { entries, issues };
}
