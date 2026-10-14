// Flake-detection preload: simulates the descheduling pauses of a loaded CI
// runner by making the wall clocks drift forward on every read. Each
// Date.now() and performance.now() call returns a value inflated by a fresh
// random 2..5ms, so wall-clock budgets (e.g. the 20ms initial-parse budget
// of @codemirror/language's LanguageState.init) expire mid-operation on
// nearly every run, at a different cut point each run. Code that stays
// correct when the machine loses CPU keeps passing here; code that does not
// fails in this mode instead of flaking on CI.
//
// The 2..5ms window is deliberate. A 20ms budget expires within the ~8
// clock reads of a small parse (largest possible single-step jump is
// 5ms < 20ms, so the cut always lands mid-parse, never before the first
// step). Meanwhile the resumed parse of code that already handles a cut
// (ensureSyntaxTree with its 50ms default budget) performs ~11 reads, whose
// drift can sum to ~38.5 +/- 3ms and therefore never reaches 50ms - the
// shim cannot manufacture failures for code that already handles a cut
// parse. Comparisons between two reads of the same clock inside one test
// stay consistent (both sides see the same drifted clock); only comparisons
// against the real system clock would notice the offset.
function driftClock(real: () => number): () => number {
  let drift = 0;
  return function () {
    drift += 2 + Math.random() * 3;
    return real() + drift;
  };
}

Date.now = driftClock(Date.now.bind(Date));
performance.now = driftClock(performance.now.bind(performance));
