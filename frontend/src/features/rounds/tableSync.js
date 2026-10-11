// Keep one read in flight and never let a pre-action read overwrite its response.
const idOf = value => String(value?._id || value || '');
const hasRevision = value => Boolean(value?.roundId || value?._id)
  && Number.isSafeInteger(value.roundNumber) && Number.isSafeInteger(value.revision);
const roundId = value => idOf(value.roundId || value._id);
const coveredBy = (change, round) => hasRevision(change) && hasRevision(round)
  && (change.roundNumber < round.roundNumber || (roundId(change) === roundId(round) && change.revision <= round.revision));
const olderThan = (change, round) => coveredBy(change, round)
  && (change.roundNumber < round.roundNumber || change.revision < round.revision);

export function createTableSync({ loadGame, loadRound, onState, onError, onLoaded }) {
  let game = null, round = null, running = null, pending = null;
  let paused = false, visible = true, disposed = false, version = 0;

  function queue(full, change) {
    const always = full || !hasRevision(change);
    const latest = !pending?.change || !coveredBy(change, pending.change) ? change : pending.change;
    pending = { full: full || pending?.full || false, always: always || pending?.always || false, change: latest };
  }
  function discardCovered() {
    if (pending && !pending.always && coveredBy(pending.change, round)) pending = null;
  }
  function run() {
    discardCovered();
    if (!pending || running || disposed || paused || !visible) return running || Promise.resolve();
    running = Promise.resolve().then(async () => {
      discardCovered();
      if (!pending || disposed || paused || !visible) return;
      const { full } = pending;
      pending = null;
      const request = version;
      try {
        let nextGame = game, nextRound;
        if (full) {
          // A setup table may legitimately deny round access.
          const [loadedGame, loadedRound] = await Promise.all([
            loadGame(), loadRound().then(value => ({ value }), error => ({ error })),
          ]);
          nextGame = loadedGame;
          if (['ACTIVE', 'ENDED'].includes(nextGame.status)) {
            if (loadedRound.error) throw loadedRound.error;
            nextRound = loadedRound.value;
          } else nextRound = null;
        } else nextRound = await loadRound();
        if (disposed || paused || !visible || request !== version) return;
        game = nextGame;
        // A delayed replica/cache response cannot roll back a newer confirmed round.
        if (!olderThan(nextRound, round)) round = nextRound;
        onState(full ? { game, round } : { round });
        onError(null);
      } catch (error) {
        if (!disposed && !paused && visible && request === version) onError(error);
      } finally {
        if (!disposed && !paused && visible && request === version) onLoaded();
      }
    }).finally(() => { running = null; run(); });
    return running;
  }
  return {
    refresh(roundOnly = false, change) {
      if (disposed || (roundOnly && coveredBy(change, round))) return Promise.resolve();
      queue(!roundOnly || !game, change);
      return run();
    },
    setVisible(value) {
      visible = value;
      if (!value) {
        version++;
        if (running) queue(true);
      }
    },
    pause() {
      paused = true;
      version++;
      if (running) queue(!game);
    },
    resume(result, succeeded = true) {
      if (disposed) return;
      paused = false;
      version++;
      if (succeeded) {
        if (result?._id && Array.isArray(result.players)) {
          if (!olderThan(result, round)) round = result;
          onState({ round });
          onError(null);
        } else queue(true);
      }
      // Drop only notifications covered by this response. Later actions by other
      // players, game changes and unversioned fallback reads still need a refresh.
      run();
    },
    dispose() { disposed = true; pending = null; version++; },
  };
}
