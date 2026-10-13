import type { ContentIssue } from './types';
import { error, isNonEmptyString, isRecord, parseAll, readList } from './validateGameplay';

/**
 * Story cards track where each claim in the game comes from. A card is `verified` only when it is a fiction the design
 * documents, or a fact with a source that has been read in full. Anything else is `needs_review`. The validator refuses
 * a fact marked verified without a source, so an unchecked fact cannot pass as checked.
 */

export type CardKind = 'fact' | 'fiction';
export type CardStatus = 'verified' | 'needs_review';

export interface CardSource {
  readonly title: string;
  readonly url: string;
}

export interface StoryCard {
  readonly id: string;
  readonly kind: CardKind;
  readonly claim: string;
  readonly status: CardStatus;
  /** Locale keys where the claim appears in the game. Every key must exist in the primary locale. */
  readonly usedIn: readonly string[];
  readonly sources: readonly CardSource[];
  readonly note: string;
}

export interface ValidatedStoryCards {
  readonly cards: readonly StoryCard[];
  readonly issues: ContentIssue[];
}

const KINDS: readonly CardKind[] = ['fact', 'fiction'];
const STATUSES: readonly CardStatus[] = ['verified', 'needs_review'];

function parseSources(raw: unknown, where: string, issues: ContentIssue[]): CardSource[] | null {
  if (!Array.isArray(raw)) {
    issues.push(error(where, '"sources" must be a list of { "title", "url" }'));
    return null;
  }
  const sources: CardSource[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || !isNonEmptyString(entry.title) || typeof entry.url !== 'string' || !entry.url.startsWith('https://')) {
      issues.push(error(where, 'each source needs a title and an https:// url'));
      return null;
    }
    sources.push({ title: entry.title, url: entry.url });
  }
  return sources;
}

function parseCard(raw: unknown, source: string, hasTextKey: (key: string) => boolean, issues: ContentIssue[]): StoryCard | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `story_cards.${raw.id}`;
  const before = issues.length;
  if (!KINDS.includes(raw.kind as CardKind)) {
    issues.push(error(where, '"kind" must be fact or fiction'));
  }
  if (!STATUSES.includes(raw.status as CardStatus)) {
    issues.push(error(where, '"status" must be verified or needs_review'));
  }
  if (!isNonEmptyString(raw.claim)) {
    issues.push(error(where, '"claim" must be a non-empty sentence'));
  }
  if (!Array.isArray(raw.usedIn) || !raw.usedIn.every((key) => typeof key === 'string' && hasTextKey(key))) {
    issues.push(error(where, '"usedIn" must list locale keys that exist in the primary locale'));
  }
  const sources = parseSources(raw.sources, where, issues);
  if (issues.length > before || !sources) {
    return null;
  }
  // The rule that matters: a fact can be verified only with a source to check it against.
  if (raw.kind === 'fact' && raw.status === 'verified' && sources.length === 0) {
    issues.push(error(where, 'a fact marked verified needs at least one source'));
    return null;
  }
  return {
    id: raw.id,
    kind: raw.kind as CardKind,
    claim: raw.claim as string,
    status: raw.status as CardStatus,
    usedIn: raw.usedIn as string[],
    sources,
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

export function validateStoryCards(raw: unknown, hasTextKey: (key: string) => boolean): ValidatedStoryCards {
  const issues: ContentIssue[] = [];
  const cards = parseAll(
    readList(raw, 'cards', issues),
    'story_cards',
    (entry, source, local) => parseCard(entry, source, hasTextKey, local),
    issues,
  );
  return { cards, issues };
}
