import type { GameStartupErrorCode } from '../../app/startupErrors';
import { t } from '../../content';

/** Startup failures plus a catch-all for errors that did not come from GameApp. */
export type StartupErrorReason = GameStartupErrorCode | 'unknown';

const MESSAGE_KEYS: Record<StartupErrorReason, string> = {
  webgl2_unavailable: 'startup.webgl2',
  engine_init_failed: 'startup.engine',
  unknown: 'startup.unknown',
};

export function StartupErrorPanel({ reason }: { readonly reason: StartupErrorReason }) {
  return (
    <section className="startup-error" role="alert">
      <h1>{t('startup.title')}</h1>
      <p>{t(MESSAGE_KEYS[reason])}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t('startup.reload')}
      </button>
    </section>
  );
}
