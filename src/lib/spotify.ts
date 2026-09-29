// Spotify types
export interface SpotifyUser {
  id: string;
  display_name: string;
  product: "free" | "premium" | "open";
  images: { url: string }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  uri: string;
  source: "spotify";
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

// PKCE helpers
export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function buildAuthUrl(challenge: string): string {
  const clientId = process.env.SPOTIFYkey110!;
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!;
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-library-read",
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  return `https://accounts.spotify.com/authorize?${params}`;
}

// API helpers
const BASE = "https://api.spotify.com/v1";

async function spotifyFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json();
}

export async function getSpotifyUser(token: string): Promise<SpotifyUser> {
  return spotifyFetch(`${BASE}/me`, token);
}

export async function getSpotifyPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch(`${BASE}/me/playlists?limit=50`, token);
  return data.items ?? [];
}

export async function getPlaylistTracks(token: string, playlistId: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch(`${BASE}/playlists/${playlistId}/tracks?limit=50`, token);
  return (data.items ?? [])
    .filter((item: { track: SpotifyTrack | null }) => item.track)
    .map((item: { track: SpotifyTrack }) => ({ ...item.track, source: "spotify" as const }));
}

export async function searchSpotifyTracks(token: string, query: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
  const data = await spotifyFetch(`${BASE}/search?${params}`, token);
  return (data.tracks?.items ?? []).map((t: SpotifyTrack) => ({ ...t, source: "spotify" as const }));
}

export async function getLikedSongs(token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch(`${BASE}/me/tracks?limit=50`, token);
  return (data.items ?? [])
    .filter((item: { track: SpotifyTrack | null }) => item.track)
    .map((item: { track: SpotifyTrack }) => ({ ...item.track, source: "spotify" as const }));
}
