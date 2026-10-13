import { describe, expect, it } from 'vitest';
import { GameStartupError, toGraphicsStartupError } from '../app/startupErrors';

describe('toGraphicsStartupError', () => {
  it('maps an AggregateError from createGraphicsDevice to webgl2_unavailable', () => {
    const cause = new AggregateError([new Error('no webgl2 context')], 'All device types failed');
    const mapped = toGraphicsStartupError(cause);

    expect(mapped).toBeInstanceOf(GameStartupError);
    expect(mapped.code).toBe('webgl2_unavailable');
    expect(mapped.cause).toBe(cause);
  });

  it('maps any other failure to engine_init_failed', () => {
    expect(toGraphicsStartupError(new Error('boom')).code).toBe('engine_init_failed');
    expect(toGraphicsStartupError('not an error object').code).toBe('engine_init_failed');
  });
});
