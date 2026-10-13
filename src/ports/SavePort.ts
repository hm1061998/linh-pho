/**
 * Where the save text lives. The game talks to this port only, so the storage can change (IndexedDB, localStorage, a
 * server later) without touching game logic. The port moves text. It does not parse or check it: that is the job of
 * the save document, so a bad save is handled the same way whatever the storage was.
 */
export interface SavePort {
  /** The stored text, or null when nothing is stored. */
  read(): Promise<string | null>;
  /** Stores the text. Resolves false when no backend accepted it. */
  write(text: string): Promise<boolean>;
  /** Keeps a copy of text that could not be used, so a bad save is never silently lost. */
  writeBackup(text: string): Promise<boolean>;
}
