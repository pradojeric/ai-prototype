# Implementation Plan — GameOn Portal API

## Design contract

- **Player promise:** finishing the complete Strings journey can safely award the
  game-level platform artifact without putting local progress at risk.
- **Target feeling:** trustworthy and unobtrusive; account state is visible, while
  platform outages never interrupt play.
- **Core loop:** explore, fight, recover each zone's memories and Soul, then return
  them to the museum. The platform reward is outside the repeated collection loop.
- **Progression gate:** every zone in `zoneOrder` must be in `completed`, the player
  must begin the real ending, and no progression shortcut may have been used.
- **Failure/retry:** authorization and unlock failures remain queued and retryable;
  game progression, ending playback, and local museum state continue normally.
- **Non-goals:** no Next.js conversion, local proxy, account credentials, database,
  persistent campaign save, or live request while `GAME_ID` is a placeholder.

## Runtime implementation

1. Replace the legacy collection-posting `APIManager` with the guide's session
   boundary: create a session, safely open `signinUrl`, poll every three seconds,
   renew expired sessions, and send the bodyless artifact unlock after authorization.
2. Add inert `PLATFORM_API` configuration and centralize exact endpoint generation
   for `https://gameonportal.ph/api/session` and
   `https://gameonportal.ph/api/artifacts/unlock`.
3. Add shared title/Settings Connect, Reconnect, status, and retry UI with
   `aria-live`; placeholder configuration performs no popup or network activity.
4. Remove the per-collection external call. Queue one platform unlock when the real
   ending begins and the campaign gate passes.
5. Invalidate platform reward eligibility when the final-cutscene test shortcut or
   presenter progression skip fabricates campaign progress.
6. Preserve local collection and ending behavior on every API failure, and dispose
   listeners, timers, and in-flight requests on browser unload.

## Verification

1. Mock exact session/unlock URLs, request bodies, bearer headers, polling,
   expiration, malformed responses, popup blocking, placeholder inactivity,
   queued retries, duplicate coalescing, and disposal.
2. Test the pure campaign gate for incomplete, legitimate-complete, and
   shortcut-assisted runs.
3. Run JavaScript syntax, relative-import, DOM-ID, 1000-line, whitespace, and
   stale-placeholder audits.
4. Confirm `main` remains the working branch and `feat/auth` keeps its original tip.
5. Leave live popup, CORS, portal response, and both-host deployment checks pending
   until a real Game ID is supplied.
