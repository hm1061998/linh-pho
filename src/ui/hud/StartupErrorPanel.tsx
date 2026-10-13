import type { GameStartupErrorCode } from '../../app/startupErrors';

/** Startup failures plus a catch-all for errors that did not come from GameApp. */
export type StartupErrorReason = GameStartupErrorCode | 'unknown';

// Player-facing copy. Module 08 moves these into locale files (vi/en).
const MESSAGES: Record<StartupErrorReason, string> = {
  webgl2_unavailable:
    'Trình duyệt hoặc thiết bị này chưa bật WebGL2, nên chưa thể vẽ cảnh 3D. ' +
    'Hãy thử bản Chrome, Edge hoặc Firefox mới nhất và bật tăng tốc phần cứng.',
  engine_init_failed: 'Không khởi động được engine đồ họa. Tải lại trang để thử lại.',
  unknown: 'Đã có lỗi không xác định khi khởi động game. Tải lại trang để thử lại.',
};

export function StartupErrorPanel({ reason }: { readonly reason: StartupErrorReason }) {
  return (
    <section className="startup-error" role="alert">
      <h1>Không thể mở Linh Phố</h1>
      <p>{MESSAGES[reason]}</p>
      <button type="button" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </section>
  );
}
