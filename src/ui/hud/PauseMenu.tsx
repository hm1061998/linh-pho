import { useEffect, useRef, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import type { SaveController } from '../../app/SaveController';
import { t } from '../../content';
import { assignKey, DEFAULT_KEY_MAP, keyLabel, REMAP_ACTIONS, type RemapAction } from '../../domain/input/keyMap';
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
  /** The action waiting for a new key, or null. */
  const [capturing, setCapturing] = useState<RemapAction | null>(null);
  const [keyNotice, setKeyNotice] = useState('');

  // While a key is being chosen, the next key press is the new key. Capture runs before the game and the Escape handler
  // above, so the press never walks the player or closes the menu. Escape cancels.
  useEffect(() => {
    if (capturing === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setCapturing(null);
        setKeyNotice('');
        return;
      }
      if (event.repeat) {
        return;
      }
      const next = assignKey(game.input.bindings.current, capturing, event.code);
      if (next === null) {
        setKeyNotice(t('pause.keys.reserved'));
        return;
      }
      controller.updateSettings({ keys: next });
      setSettingsView(controller.getSettings());
      setCapturing(null);
      setKeyNotice('');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, controller, game]);

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

  // Opening the menu moves focus to its first button, so keyboard and screen-reader users land inside it. Closing it
  // returns focus to where it was.
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!paused) {
      return;
    }
    const returnTo = document.activeElement;
    menuRef.current?.querySelector<HTMLElement>('.pause-primary')?.focus({ preventScroll: true });
    return () => {
      if (returnTo instanceof HTMLElement) {
        returnTo.focus({ preventScroll: true });
      }
    };
  }, [paused]);

  useEffect(() => {
    if (!paused) {
      setConfirming(false);
      setCapturing(null);
      setKeyNotice('');
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
    <section ref={menuRef} className="pause-menu" role="dialog" aria-modal="true" aria-labelledby="pause-title">
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
        <button type="button" aria-pressed={settings.largeText} onClick={() => update({ largeText: !settings.largeText })}>
          {`${t('pause.large_text')}: ${settings.largeText ? t('pause.on') : t('pause.off')}`}
        </button>
        <button type="button" onClick={() => update({ quality: nextQuality(settings.quality) })}>
          {`${t('pause.quality')}: ${t(`pause.quality.${settings.quality}`)}`}
        </button>
      </div>
      <fieldset className="pause-row pause-keys">
        <legend>{t('pause.keys.title')}</legend>
        {REMAP_ACTIONS.map((action) => (
          <div key={action} className="pause-key">
            <span>{t(`pause.key.${action}`)}</span>
            <kbd aria-hidden="true">{keyLabel(settings.keys[action])}</kbd>
            <button
              type="button"
              aria-label={`${t(`pause.key.${action}`)}: ${keyLabel(settings.keys[action])}`}
              onClick={() => {
                setKeyNotice('');
                setCapturing(action);
              }}
            >
              {capturing === action ? t('pause.keys.press') : t('pause.keys.change')}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setCapturing(null);
            setKeyNotice('');
            controller.updateSettings({ keys: DEFAULT_KEY_MAP });
            setSettingsView(controller.getSettings());
          }}
        >
          {t('pause.keys.reset')}
        </button>
        <p className="pause-key-notice" aria-live="polite">
          {keyNotice !== '' ? keyNotice : capturing !== null ? t('pause.keys.hint') : ''}
        </p>
      </fieldset>
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

const QUALITY_ORDER: readonly Settings['quality'][] = ['auto', 'low', 'mobile', 'high'];

/** The next quality choice in the cycle: auto, low, mobile, high, then back to auto. */
function nextQuality(current: Settings['quality']): Settings['quality'] {
  const index = QUALITY_ORDER.indexOf(current);
  return QUALITY_ORDER[(index + 1) % QUALITY_ORDER.length] ?? 'auto';
}

/** The HUD's menu button. Touch and keyboard players use it too, so Escape is never the only way in. */
export function MenuButton() {
  const paused = usePaused();
  return (
    <button
      type="button"
      className="menu-button"
      aria-haspopup="dialog"
      aria-expanded={paused}
      onClick={() => setPaused(!isPaused())}
    >
      {t('ui.menu.open')}
    </button>
  );
}
