# Spotify Integration — Requirements

## Introduction

Bantora currently plays server-bundled MP3s and local device files (My Library). This integration adds a third source — Spotify — allowing users to authenticate via OAuth, search Spotify's catalog, load their Spotify playlists, and play tracks using the Spotify Web Playback SDK, all within the same dark-purple player UI they already know. Local playback and the admin panel are unchanged.

---

## 1. Authentication

### 1.1 Connect

1.1 WHEN the user opens the app and has not connected Spotify THEN the system SHALL display a "Connect Spotify" button in the top bar.

1.2 WHEN the user taps "Connect Spotify" THEN the system SHALL initiate the Spotify Authorization Code Flow with PKCE and redirect the user to Spotify's authorization page.

1.3 WHEN Spotify redirects back with an authorization code THEN the system SHALL exchange that code for an access token and refresh token and store them in `localStorage`.

1.4 WHEN the stored access token has expired and the user attempts any Spotify operation THEN the system SHALL automatically refresh the access token using the refresh token without requiring the user to re-authenticate.

1.5 WHEN a token refresh fails (e.g. refresh token revoked) THEN the system SHALL clear stored tokens and display the "Connect Spotify" button again.

### 1.2 Disconnect

1.6 WHEN the user is connected to Spotify THEN the system SHALL display a "Disconnect Spotify" button in the top bar in place of "Connect Spotify".

1.7 WHEN the user taps "Disconnect Spotify" THEN the system SHALL remove all Spotify tokens from `localStorage`, stop any Spotify playback, and return to Local Mode.

---

## 2. Spotify Search

2.1 WHEN the user has connected Spotify and types in the search bar THEN the system SHALL query both local server songs AND the Spotify Web API and display results from both sources in the same results list.

2.2 WHEN Spotify results are displayed THEN the system SHALL visually distinguish them from local tracks — showing album art, artist name, and a Spotify badge or icon.

2.3 WHEN the user has not connected Spotify and types in the search bar THEN the system SHALL search only local tracks (current behaviour, unchanged).

2.4 WHEN a Spotify search returns no results THEN the system SHALL show a "No Spotify results" message in the Spotify section rather than hiding the section.

---

## 3. Spotify Playback

3.1 WHEN the user selects a Spotify track THEN the system SHALL attempt to play it using the Spotify Web Playback SDK.

3.2 WHEN the connected Spotify account is a free (non-Premium) account THEN the system SHALL NOT attempt SDK playback and SHALL display a "Spotify Premium required" message.

3.3 WHEN a Spotify track is playing THEN the existing play/pause, skip-next, and skip-prev controls SHALL control that Spotify track.

3.4 WHEN a Spotify track is playing and the user presses skip-next THEN the system SHALL advance to the next track in the active Spotify context (playlist or search results queue).

3.5 WHEN a Spotify track ends THEN the system SHALL automatically advance to the next track in the active Spotify queue, respecting repeat and shuffle settings where applicable.

3.6 WHEN the user switches from Spotify Mode to Local Mode THEN the system SHALL pause Spotify playback and resume or restart local audio.

---

## 4. Spotify Playlists

4.1 WHEN the user has connected Spotify and opens the Library panel THEN the system SHALL display a third tab labelled "Spotify" alongside the existing "Playlists" and "My Library" tabs.

4.2 WHEN the user opens the "Spotify" tab THEN the system SHALL fetch and display the user's Spotify playlists, showing each playlist's cover art, name, and track count.

4.3 WHEN the user selects a Spotify playlist THEN the system SHALL fetch that playlist's tracks and display them in the track list, each showing album art, track title, and artist name.

4.4 WHEN the user taps a track in a loaded Spotify playlist THEN the system SHALL begin playback from that track and set it as the active Spotify context.

4.5 WHEN the Spotify playlists request fails (e.g. network error) THEN the system SHALL display an error message with a retry option.

---

## 5. Unified Playback Modes

5.1 WHEN a local track is playing and the user selects a Spotify track THEN the system SHALL pause the local `<Audio>` element and hand off control to the Spotify Web Playback SDK.

5.2 WHEN a Spotify track is playing and the user selects a local track THEN the system SHALL stop SDK playback and resume local audio via the existing `<Audio>` element.

5.3 WHEN Mix All mode is active THEN the system SHALL include the user's Spotify Liked Songs in the mix alongside server-bundled tracks.

5.4 WHEN Mix All mode is active and a Spotify Liked Song is encountered in the queue THEN the system SHALL play it via the SDK; when a local song is encountered it SHALL play it via the local audio engine.

5.5 WHEN the user enables Shuffle while in Spotify Mode THEN the system SHALL shuffle the active Spotify track queue locally (client-side order) rather than calling the Spotify shuffle API endpoint.

5.6 WHEN Repeat One is active and a Spotify track ends THEN the system SHALL seek that track back to position 0 and replay it via the SDK.

---

## 6. UI Requirements

6.1 WHEN the player is in Spotify Mode THEN the system SHALL display the album art of the current Spotify track in the center album art circle (replacing the folder cover).

6.2 WHEN the player is in Spotify Mode THEN the system SHALL display the track title and artist name in place of the local track name and folder subtitle.

6.3 WHEN Spotify Mode is active THEN the top-bar mode label SHALL read "Spotify" (matching the existing "Mix Mode" label pattern).

6.4 WHEN rendering Spotify results or track lists THEN the system SHALL use the existing dark-purple Tailwind design tokens and glass morphism style — no new design system SHALL be introduced.

6.5 WHEN the user has not connected Spotify THEN the "Spotify" library tab SHALL still be visible but SHALL display a prompt to connect Spotify rather than playlist content.

---

## 7. Technical Constraints

7.1 WHEN the app stores Spotify credentials THEN the system SHALL use environment variables (`NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) and SHALL NOT hardcode credential values anywhere in source files.

7.2 WHEN server-side token operations (e.g. token exchange, refresh) require the client secret THEN the system SHALL perform those operations exclusively inside Next.js API routes — never exposing the secret to the browser.

7.3 WHEN making Spotify Web API requests from the browser THEN the system SHALL use only the access token (PKCE flow), never the client secret.

7.4 WHEN the application is deployed to Vercel THEN all Spotify functionality SHALL work without requiring any filesystem writes or persistent server state.

7.5 WHEN TypeScript strict mode is enabled THEN all new code related to Spotify SHALL compile without type errors.

---

## 8. Preserved Behaviour (Regression Prevention)

8.1 WHEN the user is not connected to Spotify THEN the system SHALL CONTINUE TO play local server-bundled songs exactly as before.

8.2 WHEN the user is in the "My Library" tab THEN the system SHALL CONTINUE TO allow creating playlists, adding local device files, and playing them via blob URLs.

8.3 WHEN the admin navigates to `/admin` THEN the system SHALL CONTINUE TO provide the file upload and folder management panel unchanged.

8.4 WHEN Mix All mode is used without Spotify connected THEN the system SHALL CONTINUE TO mix only server-bundled playlists as before.

8.5 WHEN the user uses shuffle or repeat controls on local content THEN those controls SHALL CONTINUE TO behave exactly as they do today.
