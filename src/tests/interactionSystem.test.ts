import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_INTERACTION_RANGE_M,
  InteractionSystem,
  type InteractionEvent,
} from '../engine/interaction/InteractionSystem';

function collect(system: InteractionSystem): InteractionEvent[] {
  const events: InteractionEvent[] = [];
  system.events.on('interaction.focusChanged', (event) => events.push(event));
  system.events.on('interaction.triggered', (event) => events.push(event));
  return events;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InteractionSystem range', () => {
  it('defaults to 2 m, as the GDD asks', () => {
    expect(DEFAULT_INTERACTION_RANGE_M).toBe(2);
  });

  it('focuses a target within range and clears focus when the player walks away', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'npc.a.name', position: { x: 0, z: 0 } });
    const events = collect(system);

    system.update({ x: 1.5, z: 0 });
    expect(system.focus).toEqual({ id: 'npc_a', labelKey: 'npc.a.name', actionKey: 'ui.hint.talk' });

    system.update({ x: 5, z: 0 });
    expect(system.focus).toBeNull();
    expect(events).toEqual([
      { type: 'interaction.focusChanged', target: { id: 'npc_a', labelKey: 'npc.a.name', actionKey: 'ui.hint.talk' } },
      { type: 'interaction.focusChanged', target: null },
    ]);
  });

  it('counts the boundary as in range', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    system.update({ x: DEFAULT_INTERACTION_RANGE_M, z: 0 });
    expect(system.focus?.id).toBe('npc_a');
  });

  it('ignores height and measures distance on the ground plane only', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    system.update({ x: 0, z: 1.9 });
    expect(system.focus?.id).toBe('npc_a');
  });

  it('honours a per-target range', () => {
    const system = new InteractionSystem();
    system.register({ id: 'sign', labelKey: 'k', position: { x: 0, z: 0 }, range: 0.5 });
    system.update({ x: 1, z: 0 });
    expect(system.focus).toBeNull();
  });
});

describe('InteractionSystem focus', () => {
  it('focuses only the nearest target when several are in range', () => {
    const system = new InteractionSystem();
    system.register({ id: 'far', labelKey: 'k', position: { x: 1.9, z: 0 } });
    system.register({ id: 'near', labelKey: 'k', position: { x: 0.5, z: 0 } });

    system.update({ x: 0, z: 0 });

    expect(system.focus?.id).toBe('near');
  });

  it('resolves exact ties by registration order, so results are deterministic', () => {
    const system = new InteractionSystem();
    system.register({ id: 'first', labelKey: 'k', position: { x: 1, z: 0 } });
    system.register({ id: 'second', labelKey: 'k', position: { x: -1, z: 0 } });

    system.update({ x: 0, z: 0 });

    expect(system.focus?.id).toBe('first');
  });

  it('emits focusChanged only when the focused target actually changes', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    const events = collect(system);

    system.update({ x: 1, z: 0 });
    system.update({ x: 1.2, z: 0 });
    system.update({ x: 0.8, z: 0 });

    expect(events.filter((event) => event.type === 'interaction.focusChanged')).toHaveLength(1);
  });

  it('clears focus and tells listeners when the focused target is unregistered', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    system.update({ x: 0, z: 0 });
    const events = collect(system);

    expect(system.unregister('npc_a')).toBe(true);

    expect(system.focus).toBeNull();
    expect(events).toEqual([{ type: 'interaction.focusChanged', target: null }]);
  });
});

describe('InteractionSystem press', () => {
  it('triggers the focused target exactly once per press', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    system.update({ x: 0.5, z: 0 });
    const events = collect(system);

    expect(system.press()).toBe(true);
    expect(events).toEqual([{ type: 'interaction.triggered', targetId: 'npc_a' }]);
  });

  it('does nothing outside range, so an early press never opens anything', () => {
    const system = new InteractionSystem();
    system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 } });
    system.update({ x: 10, z: 0 });
    const events = collect(system);

    expect(system.press()).toBe(false);
    expect(events).toEqual([]);
  });
});

describe('InteractionSystem registration', () => {
  it('rejects a duplicate ID and keeps the first target', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const system = new InteractionSystem();
    expect(system.register({ id: 'npc_a', labelKey: 'first', position: { x: 0, z: 0 } })).toBe(true);
    expect(system.register({ id: 'npc_a', labelKey: 'second', position: { x: 0, z: 0 } })).toBe(false);

    system.update({ x: 0, z: 0 });

    expect(system.focus?.labelKey).toBe('first');
    expect(console.warn).toHaveBeenCalled();
  });

  it('rejects a non-positive range', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const system = new InteractionSystem();
    expect(system.register({ id: 'npc_a', labelKey: 'k', position: { x: 0, z: 0 }, range: 0 })).toBe(false);
    expect(system.register({ id: 'npc_b', labelKey: 'k', position: { x: 0, z: 0 }, range: Number.NaN })).toBe(
      false,
    );
  });

  it('reports unregistering an unknown ID as a no-op', () => {
    const system = new InteractionSystem();
    expect(system.unregister('npc_missing')).toBe(false);
  });
});
