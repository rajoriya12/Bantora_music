# Implementation Plan

## Overview

This task list follows the exploratory bugfix workflow adapted for a feature integration. Since Spotify is entirely absent (no OAuth, no SDK, no UI), the "bug" is the feature gap itself. The methodology remains the same:

1. **Explore** — write tests that confirm the gap (Properties 1–8 fail today)
2. **Preserve** — write tests that confirm existing local playback is unaffected
3. **Implement** — build the integration
4. **Validate** — run all tests

---

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Spotify Feature Gap (isGapCondition)
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the gap exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that Spotify actions are impossible without the integration
  - **Scoped PBT Approach**: For each deterministic gap, scope the property to the concrete failing case to ensure reproducibility
  - Test cases to cover (from Bug Details → Feature Gap in design):
    - Assert `window.Spotify` is undefined (SDK not loaded) — `spotifySDKLoaded() === false`
    - Assert no `spotify_access_token` exists in localStorage — `spotifyTokenAvailable() === false`
    - Assert the Library panel renders exactly 2 tabs (no "Spotify" tab) — `tabCount === 2`
    - Assert a search query returns 0 Spotify results when token is null
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All assertions FAIL (confirms gap exists)
  - Document each counterexample found (e.g., "Library shows 2 tabs, expected 3")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_

- [ ] 2. Write preservation property tests (BEFORE implementing integration)
  - **Property 2: Preservation** - Local Playback Engine Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `togglePlay()` with `spotifyToken = null` calls only `audioRef.play/pause` — no SDK invocation
  - Observe: `handleNext()` advances `currentIndex` through local tracks only
  - Observe: `handlePrev()` steps back through local track list
  - Observe: Repeat One fires `audioRef.currentTime = 0` and `audioRef.play()` on `ended` event
  - Observe: My Library blob URL playback sets `audioRef.src` to a blob URL
  - Observe: Mix All (no Spotify) builds mega-playlist from server folders only
  - Write property-based tests:
    - For all `playbackMode === "local"` control actions, assert no Spotify SDK method is invoked
    - For all non-Spotify track selections, assert `audioRef.src` is a non-Spotify URL
    - For all shuffle operations on local playlists, assert `shuffledIndices` is generated correctly
    - For all repeat-one scenarios, assert `audioRef.currentTime = 0` and `play()` called
  - Verify all tests PASS on unfixed (pre-integration) code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

---

- [ ] 3. Environment and credentials setup

  - [ ] 3.1 Create `.env.local` with Spotify credentials
    - Add `NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<client_id>`
    - Add `SPOTIFY_CLIENT_SECRET=<secret>` — server-only, NEVER expose to browser
    - Add `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=https://bantoramusic.vercel.app/api/spotify/callback`
    - Verify `.env.local` is listed in `.gitignore` — NEVER commit this file
    - _Bug_Condition: isGapCondition(input) — credentials are required before any Spotify call_
    - _Requirements: 7.1, 7.2_

  - [ ] 3.2 Register redirect URIs in Spotify Developer Dashboard
    - Add `https://bantoramusic.vercel.app/api/spotify/callback`
    - Add `http://localhost:3000/api/spotify/callback`
    - _Requirements: 1.2, 1.3_

  - [ ] 3.3 Add environment variables to Vercel
    - Add `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` via Vercel dashboard or CLI
    - _Requirements: 7.1, 7.4_

---

- [ ] 4. Create TypeScript types and Spotify Web API helpers (`/src/lib/spotify.ts`)

  - [ ] 4.1 Define TypeScript interfaces
    - `SpotifyUser`: `id`, `display_name`, `product: "free" | "premium" | "open"`, `images`
    - `SpotifyTrack`: `id`, `name`, `artists`, `album` (with `images`), `duration_ms`, `uri`, `source: "spotify"`
    - `SpotifyPlaylist`: `id`, `name`, `images`, `tracks: { total: number }`
    - _Requirements: 7.5_

  - [ ] 4.2 Implement PKCE helpers
    - `generateCodeVerifier()` — 64 random bytes encoded as base64url (43–128 chars)
    - `generateCodeChallenge(verifier)` — `base64url(SHA-256(verifier))` using Web Crypto API
    - `buildAuthUrl(challenge)` — constructs Spotify auth URL with `code_challenge`, `client_id`, `redirect_uri`, `scope`, and `response_type=code`
    - _Bug_Condition: isGapCondition — no PKCE helpers exist today_
    - _Requirements: 1.2, 7.3_

  - [ ] 4.3 Implement Spotify Web API helper functions
    - `getSpotifyUser(token)` — `GET /me`, returns `SpotifyUser`
    - `getSpotifyPlaylists(token)` — `GET /me/playlists`, returns `SpotifyPlaylist[]`
    - `getPlaylistTracks(token, playlistId)` — `GET /playlists/{id}/tracks`, returns `SpotifyTrack[]`
    - `searchSpotifyTracks(token, query)` — `GET /search?type=track`, returns `SpotifyTrack[]` each with `source: "spotify"`
    - `getLikedSongs(token)` — `GET /me/tracks`, returns `SpotifyTrack[]`
    - _Requirements: 2.1, 4.2, 4.3, 5.3_

  - [ ] 4.4 Implement `withToken()` auto-refresh wrapper
    - Checks `Date.now() >= spotify_expires_at` from localStorage before each API call
    - If expired: calls `POST /api/spotify/refresh`, updates localStorage with new token and expiry
    - If refresh fails: clears all tokens from localStorage and sets `spotifyToken` to null
    - Retries original request with fresh token on success
    - _Bug_Condition: isGapCondition — no auto-refresh logic exists today_
    - _Expected_Behavior: seamless re-authentication transparent to user_
    - _Requirements: 1.4, 1.5_

---

- [ ] 5. Create API routes

  - [ ] 5.1 Create `/src/app/api/spotify/callback/route.ts`
    - `GET` handler extracts `code` and `error` from query params
    - On error: redirect to `/?spotify_error=access_denied`
    - On success: redirect to `/?spotify_code={code}` (client holds `code_verifier` in sessionStorage)
    - _Bug_Condition: isGapCondition — route does not exist today_
    - _Requirements: 1.3, 7.2_

  - [ ] 5.2 Create `/src/app/api/spotify/token/route.ts`
    - `POST` handler accepts `{ code, code_verifier, redirect_uri }` in request body
    - Exchanges with Spotify Accounts API using `SPOTIFY_CLIENT_SECRET` server-side only
    - Returns `{ access_token, refresh_token, expires_in }` on success
    - Returns `{ error }` with status 400 on failure
    - `SPOTIFY_CLIENT_SECRET` MUST NOT appear in any response body or log
    - _Bug_Condition: isGapCondition — route does not exist today_
    - _Expected_Behavior: tokens returned to client without exposing secret_
    - _Requirements: 1.3, 7.2, 7.3_

  - [ ] 5.3 Create `/src/app/api/spotify/refresh/route.ts`
    - `POST` handler accepts `{ refresh_token }` in request body
    - Calls Spotify Accounts API using `SPOTIFY_CLIENT_SECRET` server-side only
    - Returns new `{ access_token, expires_in }` on success
    - Returns `{ error }` with status 400 on failure
    - _Bug_Condition: isGapCondition — route does not exist today_
    - _Requirements: 1.4, 7.2_

---

- [ ] 6. Create `useSpotify` hook (`/src/hooks/useSpotify.ts`)

  - [ ] 6.1 Implement state
    - `spotifyToken: string | null` — loaded from localStorage on mount
    - `spotifyUser: SpotifyUser | null`
    - `spotifyPlaylists: SpotifyPlaylist[]`
    - `spotifyTracks: SpotifyTrack[]` — tracks for the currently open playlist
    - `spotifySearchResults: SpotifyTrack[]`
    - `spotifyPlayer: Spotify.Player | null`
    - `spotifyDeviceId: string | null`
    - `isPremium: boolean | null`
    - `currentSpotifyTrack: SpotifyTrack | null`
    - `playbackMode: "local" | "spotify"` — initialized to `"local"`
    - `sdkReady: boolean`
    - _Requirements: 3.1, 3.2, 4.2, 5.1, 5.2_

  - [ ] 6.2 Implement authentication actions
    - `connectSpotify()` — generates verifier, stores in sessionStorage, builds auth URL, redirects
    - `handleCallback()` — called on mount if `?spotify_code=` in URL; calls `/api/spotify/token`; stores tokens in localStorage; clears URL param and sessionStorage verifier
    - `disconnectSpotify()` — removes `spotify_access_token`, `spotify_refresh_token`, `spotify_expires_at` from localStorage; calls `player.disconnect()`; resets all state to initial values; sets `playbackMode = "local"`
    - _Bug_Condition: isGapCondition — no OAuth flow exists today_
    - _Expected_Behavior: tokens in localStorage after connect; all state reset after disconnect_
    - _Requirements: 1.2, 1.3, 1.6, 1.7_

  - [ ] 6.3 Implement SDK initialization
    - Register `window.onSpotifyWebPlaybackSDKReady` callback (guard against SDK race condition — do NOT call `new Spotify.Player` before this fires)
    - Initialize `Spotify.Player` with `name: "Bantora"` and `getOAuthToken` callback
    - Call `player.connect()` only when `isPremium === true`
    - Listen to `ready` event → store `device_id`, set `sdkReady = true`
    - Listen to `player_state_changed` → update `currentSpotifyTrack` and `isPlaying`
    - _Bug_Condition: isGapCondition — SDK not loaded today_
    - _Expected_Behavior: `spotifyDeviceId` set, SDK ready for playback_
    - _Preservation: SDK initialization MUST NOT interfere with `audioRef` or local playback state_
    - _Requirements: 3.1, 3.2, 5.1_

  - [ ] 6.4 Implement playback actions
    - `playSpotifyTrack(track)` — checks `isPremium`; if free, shows "Spotify Premium required"; otherwise calls Spotify `PUT /me/player/play` with `device_ids=[deviceId]` and `uris=[track.uri]`; sets `playbackMode = "spotify"`, `currentSpotifyTrack = track`
    - `pauseSpotify()` — calls `player.pause()`
    - `resumeSpotify()` — calls `player.resume()`
    - `nextSpotifyTrack()` — advances to next track in active Spotify context
    - `prevSpotifyTrack()` — steps back to previous track
    - _Bug_Condition: isGapCondition — no SDK player exists today_
    - _Expected_Behavior: playbackMode transitions, album art and track name update_
    - _Preservation: when playbackMode switches from "spotify" to "local", audioRef resumes; vice versa audioRef pauses_
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2_

  - [ ] 6.5 Implement data-loading actions
    - `loadPlaylists()` — calls `getSpotifyPlaylists(token)` via `withToken`; updates `spotifyPlaylists`; on error sets error state with retry option
    - `loadPlaylistTracks(playlistId)` — calls `getPlaylistTracks(token, playlistId)` via `withToken`; updates `spotifyTracks`
    - `searchSpotify(query)` — calls `searchSpotifyTracks(token, query)` via `withToken`; updates `spotifySearchResults`
    - `loadLikedSongs()` — calls `getLikedSongs(token)` for Mix All integration
    - _Requirements: 2.1, 4.2, 4.3, 4.5, 5.3_

---

- [ ] 7. Update `/src/app/page.tsx`

  - [ ] 7.1 Add Spotify SDK script tag
    - Import `Script` from `next/script`
    - Add `<Script src="https://sdk.scdn.co/spotify-player.js" strategy="lazyOnload" />` — the `onSpotifyWebPlaybackSDKReady` callback in `useSpotify` handles readiness
    - _Requirements: 3.1_

  - [ ] 7.2 Import and wire `useSpotify` hook
    - Call `useSpotify()` at top of `MusicPlayer` component
    - Destructure all state and actions into component scope
    - Call `handleCallback()` on mount (inside existing `useEffect` or a new one) to process `?spotify_code=` if present
    - _Requirements: 1.3_

  - [ ] 7.3 Add "Connect Spotify" / "Disconnect Spotify" button to top bar
    - When `spotifyToken === null`: render "Connect Spotify" button calling `connectSpotify()`
    - When `spotifyToken !== null`: render green dot + `spotifyUser.display_name` and "Disconnect" button calling `disconnectSpotify()`
    - Use existing Tailwind design tokens — no new CSS classes
    - _Requirements: 1.1, 1.6, 6.3, 6.4_

  - [ ] 7.4 Add "Spotify" tab to the library panel
    - Extend `libraryTab` state type to `"playlists" | "mylib" | "spotify"`
    - Add Spotify tab button to the tabs row using existing tab button styles
    - When `spotifyToken === null` and tab is open: show "Connect Spotify to see your playlists" prompt
    - When `spotifyToken !== null` and tab is open: call `loadPlaylists()` and render playlist grid
    - When a playlist is selected: call `loadPlaylistTracks(id)` and render track list
    - _Requirements: 4.1, 4.2, 4.3, 6.5_

  - [ ] 7.5 Extend search to show Spotify results
    - After local results, when `spotifyToken !== null` and query is non-empty, call `searchSpotify(query)` and render `spotifySearchResults` in a separate "Spotify Results" section
    - Each Spotify result shows album art, track name, artist name, and a Spotify badge
    - When Spotify section returns no results: show "No Spotify results" message (do not hide section)
    - Use existing `glass` / `bg-white/5` / `rounded-2xl` styling
    - _Requirements: 2.1, 2.2, 2.4, 6.4_

  - [ ] 7.6 Wrap `togglePlay`, `handleNext`, `handlePrev` with mode check
    - At the TOP of each handler, check `playbackMode`:
      - If `"spotify"`: call the corresponding Spotify action (`pauseSpotify`/`resumeSpotify`, `nextSpotifyTrack`, `prevSpotifyTrack`) and return early
      - If `"local"`: fall through to the existing `audioRef` logic unchanged
    - Do NOT modify any existing `audioRef` logic below the guard
    - _Bug_Condition: isGapCondition — no Spotify handler exists today_
    - _Expected_Behavior: correct engine invoked based on playbackMode_
    - _Preservation: local control paths are byte-for-byte identical when playbackMode === "local"_
    - _Requirements: 3.3, 5.1, 5.2, 8.1, 8.5_

  - [ ] 7.7 Update `currentTrack`, `currentTrackSubtitle`, and `currentCover` derivation
    - Add Spotify mode branch BEFORE the existing local derivation:
      ```typescript
      if (playbackMode === "spotify" && currentSpotifyTrack) {
        currentTrack = currentSpotifyTrack.name
        currentTrackSubtitle = currentSpotifyTrack.artists.map(a => a.name).join(", ")
        currentCover = currentSpotifyTrack.album.images[0]?.url ?? "/logo.png"
      }
      ```
    - Existing local derivation remains unchanged below the guard
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 7.8 Integrate Mix All with Spotify Liked Songs
    - When Mix All is enabled AND `spotifyToken !== null`: call `loadLikedSongs()` and append returned `SpotifyTrack[]` to the mega-playlist queue
    - When Mix All is enabled AND `spotifyToken === null`: existing server-folder-only behavior unchanged
    - In the Mix All playback loop: when the dequeued track has `source === "spotify"`, route to `playSpotifyTrack(track)`; otherwise route to local audio engine
    - _Bug_Condition: isGapCondition — Liked Songs not included in Mix All today_
    - _Preservation: Mix All without Spotify connected MUST produce identical results to today_
    - _Requirements: 5.3, 5.4, 8.4_

---

- [ ] 8. Verify bug condition exploration test now passes

  - [ ] 8.1 Re-run Property 1 exploration tests against integrated code
    - **Property 1: Expected Behavior** - Spotify Integration Fully Wired
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - `window.Spotify` is now defined after SDK script loads
    - `spotify_access_token` is present in localStorage after OAuth connect
    - Library panel renders 3 tabs including "Spotify"
    - Search returns Spotify results when token is non-null
    - **EXPECTED OUTCOME**: All assertions PASS (confirms integration is live)
    - _Requirements: Expected Behavior Properties 1–7 from design_

  - [ ] 8.2 Re-run preservation tests against integrated code
    - **Property 2: Preservation** - Local Engine Still Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Confirm `togglePlay` with `playbackMode === "local"` still calls only `audioRef`
    - Confirm shuffle, repeat, My Library, and Mix All (no Spotify) behavior unchanged
    - **EXPECTED OUTCOME**: All preservation tests PASS (no regressions)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

---

- [ ] 9. Build and local testing

  - [ ] 9.1 Run `npm run build` — must complete with 0 TypeScript errors and 0 build errors
    - Fix any type errors in `spotify.ts`, `useSpotify.ts`, or `page.tsx` before proceeding
    - _Requirements: 7.5_

  - [ ] 9.2 Test OAuth flow locally
    - Start dev server (`npm run dev`)
    - Click "Connect Spotify" → verify redirect to Spotify authorization page
    - Authorize → verify redirect back to `http://localhost:3000/?spotify_code=...`
    - Verify `spotify_access_token` and `spotify_refresh_token` appear in localStorage
    - Verify "Disconnect Spotify" button appears with user display name
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ] 9.3 Test Spotify playback locally
    - Open "Spotify" library tab → verify playlists load
    - Select a playlist → verify tracks load with album art
    - Click a track → verify playback starts via SDK, album art updates in player
    - Click play/pause → verify SDK pause/resume called
    - Click next/prev → verify track advances/steps back
    - Click "Disconnect Spotify" → verify local audio resumes and SDK stops
    - _Requirements: 3.1, 3.3, 3.4, 4.3, 4.4, 5.2, 6.1, 6.2_

  - [ ] 9.4 Regression test — local playback
    - Disconnect Spotify (or never connect) → verify all existing local playback, shuffle, repeat, and My Library behavior is unchanged
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

---

- [ ] 10. Deploy to Vercel

  - [ ] 10.1 Push to GitHub → Vercel auto-deploys
    - Ensure `.env.local` is NOT committed (verify `.gitignore`)
    - Confirm all three environment variables are set in Vercel dashboard before deployment

  - [ ] 10.2 Verify production at `bantoramusic.vercel.app`
    - Repeat OAuth flow, playback, and regression checks against production URL
    - _Requirements: 7.4_

---

- [ ] 11. Checkpoint — Ensure all tests pass
  - Run full test suite
  - Confirm Property 1 (bug condition / integration) tests pass
  - Confirm Property 2 (preservation / local engine) tests pass
  - Confirm `npm run build` is clean
  - Confirm production deploy is healthy
  - Ask the user if any questions arise before marking complete
