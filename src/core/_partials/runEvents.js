// ============================================================
// RUN EVENTS — the tiny document-level bus the run tally listens on
// ============================================================
// The codebase already announces a few gameplay beats this way
// (`strings:lumina-effect`, `strings:alab-ready` — see ui/JourneyGuide.js). The
// pause menu's run stats need a handful more from deep inside combat, and a
// broadcast keeps ThreatBody and the arena controllers from having to know that
// a tally exists at all. Fire-and-forget only: nothing reads a return value,
// and a missing listener is not an error.

export const RUN_EVENT = Object.freeze({
  ECHO_DEFEATED: 'strings:echo-defeated',
  BUGTONG: 'strings:bugtong',          // detail: { correct: boolean }
});

export function emitRunEvent(name, detail = null) {
  // Guarded so combat modules stay importable in a DOM-less harness.
  if (typeof document === 'undefined' || !document.dispatchEvent) return;
  document.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
}
