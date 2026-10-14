import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { AssemblyGame, ASSEMBLY_SOCKET_IDS } from '../domain/minigame/AssemblyGame';

function fitAll(game: AssemblyGame, offset: number): void {
  for (const id of ASSEMBLY_SOCKET_IDS) {
    game.place(id, offset);
  }
}

describe('AssemblyGame', () => {
  it('has one socket for each bamboo the wooden lantern recipe takes', () => {
    const recipe = GAME_CONTENT.recipes.find((candidate) => candidate.id === 'recipe_wooden_lantern');
    const bamboo = recipe?.inputs.find((input) => input.itemId === 'bamboo');
    expect(bamboo?.count).toBe(ASSEMBLY_SOCKET_IDS.length);
  });

  it('starts playing, and completes after the second fit', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    expect(game.status).toBe('playing');
    expect(game.place('socket_a', 0)).toEqual({ ok: true, status: 'playing' });
    expect(game.place('socket_b', 0)).toEqual({ ok: true, status: 'complete' });
    expect(game.status).toBe('complete');
  });

  it('refuses unknown and filled sockets without changing anything', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    game.place('socket_a', 0);
    expect(game.place('socket_z', 0)).toEqual({ ok: false, reason: 'unknown_socket' });
    expect(game.place('socket_a', 0)).toEqual({ ok: false, reason: 'already_filled' });
    expect(game.sockets().filter((socket) => socket.filled)).toHaveLength(1);
    expect(game.misses).toBe(0);
  });

  it('counts a drop past the snap edge as a miss, and fits nothing', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    expect(game.place('socket_a', 1.5)).toEqual({ ok: false, reason: 'miss' });
    expect(game.place('socket_a', Infinity)).toEqual({ ok: false, reason: 'miss' });
    expect(game.place('socket_a', Number.NaN)).toEqual({ ok: false, reason: 'miss' });
    expect(game.misses).toBe(3);
    expect(game.sockets().every((socket) => !socket.filled)).toBe(true);
  });

  it('refuses every drop once the frame is complete', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    fitAll(game, 0);
    expect(game.place('socket_a', 0)).toEqual({ ok: false, reason: 'finished' });
    expect(game.place('socket_a', Infinity)).toEqual({ ok: false, reason: 'finished' });
    expect(game.misses).toBe(0);
  });

  it('gives Perfect for dead-centre fits, and Normal for edge fits', () => {
    const centred = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    fitAll(centred, 0);
    expect(centred.quality).toBe('perfect');

    const edged = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    fitAll(edged, 1);
    expect(edged.quality).toBe('normal');
  });

  it('gives Good for fits about halfway out', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    fitAll(game, 0.5);
    expect(game.quality).toBe('good');
  });

  it('lowers the score for each miss, but never past the fit accuracy', () => {
    const clean = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    fitAll(clean, 0.5);

    const missy = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    missy.place('socket_a', 9);
    missy.place('socket_a', 9);
    fitAll(missy, 0.5);
    expect(missy.score).toBeLessThan(clean.score);
    expect(missy.score).toBeGreaterThanOrEqual(0);
  });

  it('has no quality until it is complete', () => {
    const game = new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    game.place('socket_a', 0);
    expect(game.quality).toBeNull();
  });
});
