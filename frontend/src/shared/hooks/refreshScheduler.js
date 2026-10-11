// Socket updates provide immediacy; polling repairs missed notifications.
// Hidden tabs do no background reads and refresh immediately when reopened.
export function createRefreshScheduler({ refresh, isConnected = () => false, onVisibility = () => {},
  document: page = globalThis.document, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null, running = null, disposed = false;
  const visible = () => !page?.hidden;
  function cancel() { if (timer !== null) clearTimer(timer); timer = null; }
  function reschedule() {
    cancel();
    if (!disposed && visible()) timer = setTimer(refreshNow, isConnected() ? 60000 : 10000);
  }
  function refreshNow() {
    cancel();
    if (disposed || !visible()) return Promise.resolve();
    if (running) return running;
    running = Promise.resolve().then(refresh).catch(() => {}).finally(() => { running = null; reschedule(); });
    return running;
  }
  function visibilityChanged() {
    cancel();
    onVisibility(visible());
    if (visible()) refreshNow();
  }
  page?.addEventListener('visibilitychange', visibilityChanged);
  onVisibility(visible());
  reschedule();
  return { reschedule, dispose() { disposed = true; cancel(); page?.removeEventListener('visibilitychange', visibilityChanged); } };
}
