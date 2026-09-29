# Spotify Integration Design

## Overview

Bantora currently supports two audio sources: server-bundled MP3s (played via `HTMLAudioElement`) and user-uploaded local files (played via blob URLs). This design adds Spotify as a third source using the Spotify Web Playback SDK and Authorization Code Flow with PKCE.

The core strategy is **additive, non-destructive**. Every existing code path in `page.tsx` remains intact. Spotify state and the SDK player are layered on top through a new `useSpotify` hook and three new API routes. A `playbackMode` discriminator (`"local" | "spotify"`) routes all control actions (play/pause, next, prev, seek) to the correct engine at runtime.

---

## Glossary

- **PKCE** (Proof Key for Code Exchange): OAuth 2.0 extension that eliminates the need to expose a client secret in the browser by using a code verifier/challenge pair.
- **code_verifier**: A cryptographically random string generated in the browser and stored in `sessionStorage`; never sent to Spotify directly.
- **code_challenge**: `base64url(SHA-256(code_verifier))`; sent to Spotify in the auth request so Spotify can verify the exchange.
- **SDK Player**: The `Spotify.Player` object instantiated from the Web Playback SDK script (`https://sdk.scdn.co/spotify-player.js`). Represents a virtual Spotify device.
- **deviceId**: The UUID Spotify assigns to the SDK Player instance at runtime; required to transfer playback to this device.
- **playbackMode**: React state discriminator — `"local"` (HTMLAudioElement engine) or `"spotify"` (SDK engine).
- **Local Mode**: Existing playback behaviour — server-bundled and My Library songs via `audioRef`.
- **Spotify Mode**: Playback via the SDK player, entered when a Spotify track is selected.
- **SpotifyUser**: Shape of the user profile returned by `GET /me`.
- **SpotifyTrack**: Unified track type that carries Spotify metadata and `source: "spotify"` to distinguish it from local tracks.
- **SpotifyPlaylist**: Shape of a Spotify playlist item returned by `GET /me/playlists`.

---

## Bug Details

> This document describes a feature integration, not a bug fix. The "Bug Details" section is replaced by a **Feature Gap Analysis** describing what is absent and what fails today if Spotify is expected.

### Feature Gap

The current application has no Spotify connection capability. Attempting any Spotify operation will fail because:

1. No OAuth flow exists — there is no way to obtain an access token.
2. No Spotify Web Playback SDK is loaded — `window.Spotify` is `undefined`.
3. The library panel has only two tabs — there is no "Spotify" tab.
4. The `currentCover` and `currentTrack` derivation only handles local sources.

**Formal Gap Specification:**
```
FUNCTION isGapCondition(input)
  INPUT: input of type UserAction
  OUTPUT: boolean

  RETURN input.type IN ['selectSpotifyTrack', 'openSpotifyTab',
                        'connectSpotify', 'searchWithSpotify']
         AND spotifyTokenAvailable() = false
         AND spotifySDKLoaded() = false
END FUNCTION
```

### Examples

- User clicks "Connect Spotify" → button does not exist → action impossible
- User searches for a song → only local results appear, Spotify results absent
- User opens Library → only "Playlists" and "My Library" tabs visible, "Spotify" tab absent
- User selects a Spotify track (post-connect) → no SDK player → playback silently fails

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Server-bundled playlist loading from `/songs/{folder}/playlist.json` must continue to work identically (Requirements 8.1, 8.3).
- My Library — playlist creation, file upload via blob URLs, localStorage persistence — must be unaffected (Requirement 8.2).
- Admin panel at `/admin` must continue to function without modification (Requirement 8.3).
- Mix All mode combining server-bundled folders must behave identically when Spotify is not connected (Requirement 8.4).
- Shuffle and repeat controls on local content must behave exactly as they do today (Requirement 8.5).
- The `audioRef` (HTMLAudioElement) remains the sole audio engine for all non-Spotify playback.

**Scope of Change:**
All code paths that do NOT involve Spotify track selection or the Spotify tab must produce identical results before and after this integration. This includes:
- `togglePlay`, `handlePrev`, `handleNext` when `playbackMode === "local"`
- My Library blob URL playback
- Server playlist folder switching
- Shuffle index generation
- Repeat mode cycling

---

## Hypothesized Root Cause

The Spotify integration is absent because it was never implemented. There is no defect in existing code — only missing functionality. Potential implementation pitfalls to guard against:

1. **Secret exposure**: Using the client secret directly in client-side code instead of routing through API routes (violates Requirement 7.2).
2. **SDK race condition**: Initializing `Spotify.Player` before `window.onSpotifyWebPlaybackSDKReady` fires, causing a "Spotify is not defined" error.
3. **Playback engine collision**: Both `audioRef` and the SDK player attempting to play simultaneously if mode-switching logic has a gap.
4. **Token expiry not handled**: Making Spotify API calls with a stale access token without first refreshing, causing 401 errors on operations that appear to work initially.
5. **Free account crash**: Calling `player.connect()` or `player.resume()` on a free account without checking `product === "premium"` first (SDK operations require Premium).

---

## Correctness Properties

Property 1: Spotify Authentication — Token Acquisition

_For any_ user action that triggers the Spotify connect flow, the system SHALL complete the PKCE exchange (generating verifier → challenge → code → token) and store `spotify_access_token`, `spotify_refresh_token`, and `spotify_expires_at` in `localStorage` without ever transmitting `SPOTIFY_CLIENT_SECRET` to the browser.

**Validates: Requirements 1.2, 1.3, 7.2, 7.3**

Property 2: Token Auto-Refresh — Seamless Re-Authentication

_For any_ Spotify API call made when `Date.now() >= spotify_expires_at`, the system SHALL automatically call `/api/spotify/refresh`, update `localStorage` with the new token, and retry the original request — transparent to the user.

**Validates: Requirements 1.4, 1.5**

Property 3: Playback Mode Isolation — Local Engine Preservation

_For any_ control action (play/pause, next, prev, seek) where `playbackMode === "local"`, the system SHALL route exclusively to `audioRef` and SHALL NOT invoke any Spotify SDK method, producing results identical to the pre-integration behavior.

**Validates: Requirements 5.1, 5.2, 8.1, 8.4, 8.5**

Property 4: Spotify Playback Correctness — SDK Engine Routing

_For any_ control action where `playbackMode === "spotify"` and `isPremium === true`, the system SHALL route to the Spotify SDK player, and SHALL NOT call `audioRef.play()` or `audioRef.pause()`.

**Validates: Requirements 3.1, 3.3, 3.4, 5.1**

Property 5: Premium Gate — Free Account Protection

_For any_ attempt to initiate Spotify SDK playback where `spotifyUser.product !== "premium"`, the system SHALL display a "Spotify Premium required" message and SHALL NOT call `player.connect()` or attempt SDK playback.

**Validates: Requirement 3.2**

Property 6: Search Result Composition — Dual-Source Results

_For any_ search query typed when `spotifyToken !== null`, the system SHALL return results from BOTH local tracks and the Spotify Web API, visually distinguished by a Spotify badge, album art, and artist name.

**Validates: Requirements 2.1, 2.2, 6.4**

Property 7: Spotify Playlist Display — Tab and Content

_For any_ user opening the Library panel when `spotifyToken !== null`, the system SHALL show three tabs ("Playlists", "My Library", "Spotify") and the Spotify tab SHALL display the user's playlists fetched from `GET /me/playlists`.

**Validates: Requirements 4.1, 4.2, 6.5**

Property 8: Preservation — Disconnect Clears State

_For any_ user action that triggers disconnect, the system SHALL clear all Spotify tokens from `localStorage`, stop SDK playback, set `playbackMode` back to `"local"`, and return `spotifyToken` to `null`, restoring the pre-connect state exactly.

**Validates: Requirements 1.6, 1.7, 3.6**

---

## Fix Implementation

### New Files

**1. `/src/app/api/spotify/callback/route.ts`**

Handles the OAuth redirect from Spotify. Extracts `code` and `state` from query params, then redirects to the main page with the code attached so the client can complete the PKCE exchange.

```typescript
// GET /api/spotify/callback?code=...&state=...
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/?spotify_error=access_denied', request.url))
  }

  // Pass code back to client — client holds the code_verifier in sessionStorage
  return NextResponse.redirect(new URL(`/?spotify_code=${code}`, request.url))
}
```

**2. `/src/app/api/spotify/token/route.ts`**

Exchanges the PKCE authorization code for tokens. Uses `SPOTIFY_CLIENT_SECRET` server-side only.

```typescript
// POST /api/spotify/token
// Body: { code: string, code_verifier: string, redirect_uri: string }
export async function POST(request: NextRequest) {
  const { code, code_verifier, redirect_uri } = await request.json()

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
      code_verifier,
    }),
  })

  const data = await response.json()
  if (!response.ok) return NextResponse.json({ error: data.error }, { status: 400 })
  return NextResponse.json(data)
}
```

**3. `/src/app/api/spotify/refresh/route.ts`**

Refreshes an expired access token. Uses `SPOTIFY_CLIENT_SECRET` server-side only.

```typescript
// POST /api/spotify/refresh
// Body: { refresh_token: string }
export async function POST(request: NextRequest) {
  const { refresh_token } = await request.json()

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
    }),
  })

  const data = await response.json()
  if (!response.ok) return NextResponse.json({ error: data.error }, { status: 400 })
  return NextResponse.json(data)
}
```

**4. `/src/lib/spotify.ts`**

Spotify Web API helper. All functions accept a token and return typed results. The `withToken` wrapper handles auto-refresh transparently.

```typescript
// Key functions:
export async function getSpotifyUser(token: string): Promise<SpotifyUser>
export async function getSpotifyPlaylists(token: string): Promise<SpotifyPlaylist[]>
export async function getPlaylistTracks(token: string, playlistId: string): Promise<SpotifyTrack[]>
export async function searchSpotifyTracks(token: string, query: string): Promise<SpotifyTrack[]>
export async function getLikedSongs(token: string): Promise<SpotifyTrack[]>

// PKCE helpers:
export function generateCodeVerifier(): string   // 64 random bytes, base64url
export function generateCodeChallenge(verifier: string): Promise<string> // SHA-256 + base64url
export function buildAuthUrl(challenge: string): string  // constructs Spotify auth URL
```

**5. `/src/hooks/useSpotify.ts`**

Encapsulates all Spotify lifecycle logic. Returns state and actions to `page.tsx`.

```typescript
export function useSpotify() {
  // State
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null)
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null)
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([])
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([])
  const [spotifySearchResults, setSpotifySearchResults] = useState<SpotifyTrack[]>([])
  const [spotifyPlayer, setSpotifyPlayer] = useState<Spotify.Player | null>(null)
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [currentSpotifyTrack, setCurrentSpotifyTrack] = useState<SpotifyTrack | null>(null)
  const [playbackMode, setPlaybackMode] = useState<"local" | "spotify">("local")
  const [sdkReady, setSdkReady] = useState(false)

  // Actions
  return {
    // State
    spotifyToken, spotifyUser, spotifyPlaylists, spotifyTracks,
    spotifySearchResults, spotifyPlayer, spotifyDeviceId, isPremium,
    currentSpotifyTrack, playbackMode,

    // Auth
    connectSpotify,    // initiates PKCE flow
    disconnectSpotify, // clears tokens, stops playback, resets state
    handleCallback,    // called on mount if ?spotify_code= is present in URL

    // Playback
    playSpotifyTrack,  // transfers playback to deviceId, sets playbackMode="spotify"
    pauseSpotify,
    resumeSpotify,
    nextSpotifyTrack,
    prevSpotifyTrack,

    // Data
    loadPlaylists,
    loadPlaylistTracks,
    searchSpotify,
  }
}
```

### Modified Files

**`/src/app/page.tsx`**

Changes are strictly additive — no existing logic is removed or altered:

1. Import `useSpotify` hook and spread its return values into component scope.
2. Import `Script` from `next/script` and add SDK loader:
   ```tsx
   <Script
     src="https://sdk.scdn.co/spotify-player.js"
     strategy="lazyOnload"
     onLoad={() => { /* SDK is available; useSpotify initializes player */ }}
   />
   ```
3. Add `"spotify"` as a third value to `libraryTab` state type: `"playlists" | "mylib" | "spotify"`.
4. Wrap `togglePlay`, `handleNext`, `handlePrev` with a mode check:
   ```typescript
   const togglePlay = () => {
     if (playbackMode === "spotify") {
       isPlaying ? pauseSpotify() : resumeSpotify()
       setIsPlaying(p => !p)
       return
     }
     // existing audioRef logic unchanged below
     ...
   }
   ```
5. Extend `currentTrack`, `currentTrackSubtitle`, and `currentCover` derivation:
   ```typescript
   if (playbackMode === "spotify" && currentSpotifyTrack) {
     currentTrack = currentSpotifyTrack.name
     currentTrackSubtitle = currentSpotifyTrack.artists.map(a => a.name).join(", ")
     currentCover = currentSpotifyTrack.album.images[0]?.url ?? "/logo.png"
   }
   ```
6. Add Spotify tab button to the library tabs row.
7. Add "Connect Spotify" / "Disconnect" button to the top bar.
8. Add `{libraryTab === "spotify" && <SpotifyLibraryTab ... />}` panel.
9. Extend the search results section to show Spotify results below local results when `spotifyToken !== null`.

---

## TypeScript Types

Defined in `/src/lib/spotify.ts`:

```typescript
interface SpotifyUser {
  id: string
  display_name: string
  product: "free" | "premium" | "open"
  images: { url: string }[]
}

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  duration_ms: number
  uri: string
  source: "spotify"
}

interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  tracks: { total: number }
}
```

---

## State Design

All new state lives in `useSpotify`. The hook is called once at the top of `MusicPlayer` and its values are destructured into the component. This keeps `page.tsx` clean and all Spotify concerns isolated.

### localStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `spotify_access_token` | JWT string | Current access token |
| `spotify_refresh_token` | string | Used to obtain new access tokens |
| `spotify_expires_at` | Unix timestamp (ms) | Checked before every API call |

### sessionStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `spotify_code_verifier` | base64url string | PKCE verifier, discarded after exchange |

---

## PKCE Flow Sequence

```
Browser                         /api/spotify/token         Spotify Accounts
  │                                     │                         │
  │─ generateCodeVerifier() ───────────▶│                         │
  │─ generateCodeChallenge(v) ─────────▶│                         │
  │─ store verifier in sessionStorage   │                         │
  │─ redirect to Spotify with challenge ┤──────────────────────▶  │
  │                                     │                         │
  │◀─ redirect back to /api/spotify/callback?code=XYZ ───────────│
  │◀─ redirect to /?spotify_code=XYZ                              │
  │                                     │                         │
  │─ POST /api/spotify/token ──────────▶│                         │
  │  { code, code_verifier,             │                         │
  │    redirect_uri }                   │─ exchange with secret ─▶│
  │                                     │◀─ { access_token,       │
  │◀─ { access_token, refresh_token }   │     refresh_token }     │
  │─ store in localStorage              │                         │
  │─ delete code_verifier from session  │                         │
```

---

## SDK Initialization Sequence

```
page.tsx                        useSpotify hook               Spotify SDK
  │                                  │                             │
  │─ <Script src="...player.js" /> ──┤                             │
  │                                  │                             │
  │  window.onSpotifyWebPlaybackSDKReady fires                     │
  │                                  │◀─ SDK ready callback ──────│
  │                                  │─ new Spotify.Player({       │
  │                                  │    name: "Bantora",         │
  │                                  │    getOAuthToken: cb        │
  │                                  │  })                         │
  │                                  │─ player.connect() ─────────▶│
  │                                  │◀─ ready { device_id } ──────│
  │                                  │─ setSpotifyDeviceId(id)     │
  │                                  │─ setSdkReady(true)          │
```

---

## Testing Strategy

### Validation Approach

Testing follows three phases:
1. **Exploratory** — verify the integration points behave correctly in isolation before wiring them together.
2. **Fix Checking** — verify the new Spotify features work end-to-end (Properties 1–7).
3. **Preservation Checking** — verify all existing local playback behavior is unaffected (Property 3, 8).

### Exploratory Checking

**Goal**: Verify each integration point independently before full wiring.

**Test Plan**: Test PKCE helper functions, API route request/response shapes, and SDK event handler callbacks in isolation.

**Test Cases**:
1. **PKCE Math**: `generateCodeVerifier()` produces a 43–128 character base64url string; `generateCodeChallenge(v)` round-trips correctly through SHA-256.
2. **Token Route**: `POST /api/spotify/token` with a mock Spotify response returns `{ access_token, refresh_token, expires_in }`.
3. **Refresh Route**: `POST /api/spotify/refresh` with a mock Spotify response returns a new `access_token`.
4. **Callback Route**: `GET /api/spotify/callback?code=ABC` redirects to `/?spotify_code=ABC`.
5. **Secret Leakage Check**: Verify `SPOTIFY_CLIENT_SECRET` does not appear in any file under `src/app/` outside of `api/` routes.

**Expected Counterexamples**:
- If `code_verifier` is sent to Spotify directly (rather than the challenge), the exchange will fail with `invalid_grant`.
- If the API route is missing, the callback will 404 and the OAuth flow will break silently.

### Fix Checking

**Goal**: Verify Properties 1–8 hold after implementation.

**Pseudocode:**
```
FOR ALL action WHERE isSpotifyAction(action) DO
  result := executeWithSpotifyIntegration(action)
  ASSERT correctnessProperty(action, result)
END FOR
```

**Test Cases**:
1. **Auth Connect**: Simulate PKCE flow end-to-end; assert tokens appear in localStorage.
2. **Auto-Refresh**: Manually expire the token; make an API call; assert refresh route is called and the call succeeds.
3. **Premium Gate**: Set `product: "free"`; attempt playback; assert "Spotify Premium required" is displayed, SDK not invoked.
4. **Track Play**: Set `product: "premium"`, valid token, valid deviceId; call `playSpotifyTrack(track)`; assert `playbackMode === "spotify"` and album art updates.
5. **Search Dual Results**: Type in search box with token set; assert both local and Spotify result sections render.
6. **Spotify Tab**: Open library with token; assert three tabs render; Spotify tab shows playlists.
7. **Disconnect**: Call `disconnectSpotify()`; assert localStorage cleared, `playbackMode === "local"`, `spotifyToken === null`.

### Preservation Checking

**Goal**: Verify Property 3 — local engine is unaffected.

**Pseudocode:**
```
FOR ALL action WHERE NOT isSpotifyAction(action) DO
  ASSERT localBehavior_original(action) = localBehavior_integrated(action)
END FOR
```

**Testing Approach**: Property-based testing is recommended because:
- It generates diverse local playback scenarios automatically.
- It catches edge cases like empty playlists, single-song playlists, and end-of-list repeat behavior.
- It provides strong guarantees that `audioRef` logic is unchanged across many inputs.

**Test Cases**:
1. **Local Play/Pause Preservation**: With `spotifyToken = null`, toggle play — assert only `audioRef.play/pause` is called, no Spotify SDK invocation.
2. **Shuffle Preservation**: Enable shuffle on a server playlist; assert `shuffledIndices` generated correctly, `handleNext` advances through shuffled order.
3. **Repeat One Preservation**: Enable repeat one; let `ended` event fire; assert `audioRef.currentTime = 0` and `play()` called.
4. **My Library Preservation**: Upload a file, create playlist, play song; assert `myLibSongId` set, `blobStore` used, `audioRef.src` set to blob URL.
5. **Mix All Preservation** (no Spotify): Enable Mix All; assert mega-playlist constructed from server folders only, no Spotify API called.

### Unit Tests

- Test `generateCodeVerifier` and `generateCodeChallenge` output format and length.
- Test `buildAuthUrl` includes `code_challenge`, `client_id`, `redirect_uri`, and `scope` params.
- Test `useSpotify` hook: `connectSpotify` stores verifier in sessionStorage and calls `window.location.href`.
- Test `useSpotify` hook: `disconnectSpotify` removes all three localStorage keys and resets state.
- Test `useSpotify` hook: `handleCallback` with `?spotify_code=` present calls the token route and stores result.
- Test API routes: token exchange, token refresh, and callback redirect with both success and error cases.

### Property-Based Tests

- Generate random arrays of `SpotifyTrack` objects; assert `searchSpotifyTracks` results always include `source: "spotify"` on each item.
- Generate random playlists (0–100 songs); assert `handleNext` in Spotify mode never references `audioRef`.
- Generate random expired/valid token timestamps; assert `withToken` wrapper calls refresh if and only if `Date.now() >= expires_at`.
- Generate random user `product` values; assert SDK `connect()` is only called when `product === "premium"`.

### Integration Tests

- Full OAuth PKCE flow: start app → click connect → assert redirect URL structure → simulate callback → assert tokens in localStorage.
- Full Spotify playback flow: connect → load playlists → select track → assert `playbackMode === "spotify"` → click pause → assert SDK pause called.
- Mode switching: play Spotify track → select local track → assert `audioRef` resumes and SDK pauses.
- Mix All with Spotify: connect → enable Mix All → assert Liked Songs fetched and queued alongside server songs.
- Regression: connect Spotify → navigate to My Library tab → upload file → play → assert local audio plays (not SDK).

---

## Environment Variables

```
# .env.local
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<client_id>
SPOTIFY_CLIENT_SECRET=<secret>           # server-only, never exposed to browser
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=https://bantoramusic.vercel.app/api/spotify/callback
```

For local development, also register `http://localhost:3000/api/spotify/callback` in the Spotify Developer Dashboard.

---

## UI Change Summary

| Location | Current | After |
|----------|---------|-------|
| Top bar (left) | Mode label ("Mix Mode" etc.) | Unchanged |
| Top bar (right) | Mix All, Admin, Library buttons | + "Connect Spotify" button (before Library) |
| Top bar (right, connected) | — | Replace connect button with green dot + display name |
| Library tabs | Playlists · My Library | Playlists · My Library · **Spotify** |
| Library Spotify tab | — | Playlist grid (cover, name, count) |
| Library Spotify tab (not connected) | — | "Connect Spotify to see your playlists" prompt |
| Search results | Local tracks only | + Spotify results section with album art and Spotify badge |
| Album art circle | Folder cover or logo | Spotify album art when `playbackMode === "spotify"` |
| Track title | Cleaned filename | Spotify track name + artist when in Spotify mode |
| Top bar mode label | "Mix Mode" or folder name | "Spotify" when `playbackMode === "spotify"` |

All new UI uses existing Tailwind design tokens (`glass`, `animate-grad`, `bg-white/5`, `rounded-2xl`, `border-white/10`, etc.). No new CSS classes or design tokens are introduced.
