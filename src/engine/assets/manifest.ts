import assetsJson from '../../content/assets.json';
import { validateAssets, type AssetManifestEntry } from '../../domain/content/validateAssets';
import type { AssetEntry, AssetSource } from './AssetLoader';
import { buildCrateGlb } from './testGlb';

/** The engine's generators. Their names must match `KNOWN_GENERATORS` in the domain validator. */
const GENERATORS: Readonly<Record<string, () => Uint8Array<ArrayBuffer>>> = {
  crate: buildCrateGlb,
};

/** The validated manifest, with any issues. Problems are logged once at startup and never stop the game. */
export const ASSET_MANIFEST = validateAssets(assetsJson);

function sourceFor(entry: AssetManifestEntry): AssetSource | null {
  if (!entry.source) {
    return null;
  }
  if (entry.source.kind === 'url') {
    return { kind: 'url', url: entry.source.url };
  }
  const build = GENERATORS[entry.source.generator];
  return build ? { kind: 'generated', bytes: build(), filename: `${entry.source.generator}.glb` } : null;
}

export function toAssetEntries(entries: readonly AssetManifestEntry[]): AssetEntry[] {
  return entries.map((entry) => ({ id: entry.id, source: sourceFor(entry), idleAnimation: entry.idleAnimation }));
}
