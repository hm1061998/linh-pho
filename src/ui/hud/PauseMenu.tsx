import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import type { SaveController } from '../../app/SaveController';
import { t } from '../../content';
import type { Settings } from '../../domain/save/SaveDocument';
import { isPaused, setPaused, usePaused } from '../state/menuStore';

/** Input blocker name. While the menu is open, gameplay input reads as neutral. */
const PAUSE_BLOCKER = 'pause';

/**
 * The pause menu, opened by Escape or the Menu button. Escape also closes an open panel first, so one key never does
 * two things at once. Dialogue owns its keys, so Escape does nothing while a conversation is open. Settings apply and
 * save at once. Starting over asks first, because it erases the current playthrough.
 */
export function PauseMenu({ game, controller }: { readonly game: GameApp; readonly controller: SaveController }) {
  const paused = usePaused();
  const [settings, setSettingsView] = useState<Settings>(() => controller.getSettings());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat || game.session.dialogue.isOpen) {
        return;
      }
      event.preventDefault();
      if (game.session.currentPanel) {
        game.session.closePanel();
        return;
      }
      setPaused(!isPaused());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game]);

  // The blocker is removed when the menu closes, and also if this component unmounts while the menu is open.
  useEffect(() => {
    if (!paused) {
      return;
    }
    game.input.pushBlocker(PAUSE_BLOCKER);
    return () => game.input.popBlocker(PAUSE_BLOCKER);
  }, [game, paused]);

  useEffect(() => {
    if (!paused) {
      setConfirming(false);
    }
  }, [paused]);

  if (!paused) {
    return null;
  }

  const update = (patch: Partial<Settings>) => {
    controller.updateSettings(patch);
    setSettingsView(controller.getSettings());
  };

  const restart = () => {
    setPaused(false);
    void controller.restart();
  };

  return (
    <section className="pause-menu" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <h2 id="pause-title">{t('pause.title')}</h2>
      <button type="button" className="pause-primary" onClick={() => setPaused(false)}>
        {t('pause.resume')}
      </button>
      <fieldset className="pause-row">
        <legend>{t('pause.language')}</legend>
        <button type="button" aria-pressed={settings.language === 'vi'} onClick={() => update({ language: 'vi' })}>
          Tiếng Việt
        </button>
        <button type="button" aria-pressed={settings.language === 'en'} onClick={() => update({ language: 'en' })}>
          English
        </button>
      </fieldset>
      <div className="pause-row">
        <button
          type="button"
          aria-pressed={settings.reducedEffects}
          onClick={() => update({ reducedEffects: !settings.reducedEffects })}
        >
          {`${t('pause.reduced_effects')}: ${settings.reducedEffects ? t('pause.on') : t('pause.off')}`}
        </button>
        <button type="button" aria-pressed={settings.soundOn} onClick={() => update({ soundOn: !settings.soundOn })}>
          {`${t('pause.sound')}: ${settings.soundOn ? t('pause.on') : t('pause.off')}`}
        </button>
      </div>
      {confirming ? (
        <div className="pause-confirm">
          <p>{t('pause.restart_confirm')}</p>
          <button type="button" onClick={restart}>
            {t('pause.restart_yes')}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t('pause.restart_no')}
          </button>
        </div>
      ) : (
        <button type="button" className="pause-restart" onClick={() => setConfirming(true)}>
          {t('pause.restart')}
        </button>
      )}
    </section>
  );
}

/** The HUD's menu button. Touch and keyboard players use it too, so Escape is never the only way in. */
export function MenuButton() {
  return (
    <button type="button" className="menu-button" aria-haspopup="dialog" onClick={() => setPaused(!isPaused())}>
      {t('ui.menu.open')}
    </button>
  );
}
