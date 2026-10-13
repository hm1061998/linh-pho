import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import { renderNotice } from '../state/useSession';

const NOTICE_LIFETIME_MS = 2600;
const MAX_VISIBLE = 3;

interface Notice {
  readonly id: number;
  readonly text: string;
}

/**
 * Short toasts for what just happened: collected, crafted, quest done, refused action. Notices come from the
 * session as keys, and this component translates them. Each one fades out on its own.
 */
export function NoticeStack({ game }: { readonly game: GameApp }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let nextId = 1;
    const off = game.session.events.on('notice', (event) => {
      const id = nextId++;
      const text = renderNotice(event.textKey, event.params);
      setNotices((current) => [...current, { id, text }].slice(-MAX_VISIBLE));
      window.setTimeout(() => {
        setNotices((current) => current.filter((notice) => notice.id !== id));
      }, NOTICE_LIFETIME_MS);
    });
    return off;
  }, [game]);

  if (notices.length === 0) {
    return null;
  }
  return (
    <div className="notice-stack" role="status" aria-live="polite">
      {notices.map((notice) => (
        <p key={notice.id}>{notice.text}</p>
      ))}
    </div>
  );
}
