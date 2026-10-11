// Keep one table read in flight. Socket bursts queue at most one follow-up read,
// and reads started before an action cannot overwrite its confirmed response.
export function createTableSync({ loadGame, loadRound, onState, onError, onLoaded }) {
  let game = null;
  let running = null;
  let pending = null;
  let paused = false;
  let disposed = false;
  let version = 0;

  function refresh(roundOnly = false) {
    if (disposed) return Promise.resolve();
    pending = { full: pending?.full || !roundOnly || !game };
    if (running || paused) return running || Promise.resolve();

    running = Promise.resolve().then(async () => {
      if (disposed || paused) return;
      const full = pending.full;
      pending = null;
      const request = version;
      try {
        let nextGame = game;
        let round;
        if (full) {
          // Load both independently; a setup table may legitimately deny round access.
          const [loadedGame, loadedRound] = await Promise.all([
            loadGame(),
            loadRound().then(value => ({ value }), error => ({ error })),
          ]);
          nextGame = loadedGame;
          if (['ACTIVE', 'ENDED'].includes(nextGame.status)) {
            if (loadedRound.error) throw loadedRound.error;
            round = loadedRound.value;
          } else round = null;
        } else round = await loadRound();
        if (disposed || paused || request !== version) return;
        game = nextGame;
        onState(full ? { game, round } : { round });
        onError(null);
      } catch (error) {
        if (!disposed && !paused && request === version) onError(error);
      } finally {
        if (!disposed && !paused && request === version) onLoaded();
      }
    }).finally(() => {
      running = null;
      if (pending && !disposed && !paused) refresh(!pending.full);
    });
    return running;
  }

  return {
    refresh,
    pause() {
      paused = true;
      version++;
      if (running) pending = { full: pending?.full || !game };
    },
    resume(result, succeeded = true) {
      if (disposed) return;
      paused = false;
      version++;
      if (succeeded) {
        if (result?._id && Array.isArray(result.players)) {
          onState({ round: result });
          onError(null);
        } else pending = { full: true };
      }
      // Refresh any events received during the action in the background. Never
      // hold the player's controls disabled waiting for these fallback reads.
      if (pending) refresh(!pending.full);
    },
    dispose() { disposed = true; pending = null; version++; },
  };
}
