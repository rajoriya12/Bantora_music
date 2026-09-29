"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SpotifyUser, SpotifyTrack, SpotifyPlaylist,
  generateCodeVerifier, generateCodeChallenge, buildAuthUrl,
  getSpotifyUser, getSpotifyPlaylists, getPlaylistTracks,
  searchSpotifyTracks, getLikedSongs,
} from "@/lib/spotify";

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayer {
  addListener: (event: string, cb: (data: unknown) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
}

const LS_TOKEN = "spotify_access_token";
const LS_REFRESH = "spotify_refresh_token";
const LS_EXPIRES = "spotify_expires_at";
const SS_VERIFIER = "spotify_code_verifier";

export type PlaybackMode = "local" | "spotify";

export function useSpotify() {
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([]);
  const [spotifySearchResults, setSpotifySearchResults] = useState<SpotifyTrack[]>([]);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [currentSpotifyTrack, setCurrentSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("local");
  const [sdkReady, setSdkReady] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Load token from localStorage on mount + handle OAuth callback
  useEffect(() => {
    const token = localStorage.getItem(LS_TOKEN);
    if (token) setSpotifyToken(token);

    // Handle OAuth callback code in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("spotify_code");
    const error = params.get("spotify_error");

    if (error) {
      setSpotifyError("Spotify login was cancelled.");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code) {
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      handleCallback(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile and playlists when token is available
  useEffect(() => {
    if (!spotifyToken) return;
    getSpotifyUser(spotifyToken)
      .then(user => {
        setSpotifyUser(user);
        setIsPremium(user.product === "premium");
        getSpotifyPlaylists(spotifyToken).then(setSpotifyPlaylists).catch(() => {});
      })
      .catch(() => {
        // Token might be expired, try refresh
        refreshToken();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyToken]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!spotifyToken || !isPremium) return;

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: "Bantora",
        getOAuthToken: (cb: (token: string) => void) => {
          const t = localStorage.getItem(LS_TOKEN);
          if (t) cb(t);
        },
        volume: 0.8,
      });

      player.addListener("ready", (data: unknown) => {
        const { device_id } = data as { device_id: string };
        setSpotifyDeviceId(device_id);
        setSdkReady(true);
      });

      player.addListener("not_ready", () => {
        setSdkReady(false);
      });

      player.addListener("player_state_changed", (state: unknown) => {
        if (!state) return;
        const s = state as {
          track_window?: {
            current_track?: {
              id: string;
              name: string;
              artists: { name: string }[];
              album: { name: string; images: { url: string }[] };
              duration_ms: number;
              uri: string;
            };
          };
        };
        const track = s.track_window?.current_track;
        if (track) {
          setCurrentSpotifyTrack({
            id: track.id,
            name: track.name,
            artists: track.artists,
            album: { name: track.album.name, images: track.album.images },
            duration_ms: track.duration_ms,
            uri: track.uri,
            source: "spotify",
          });
        }
      });

      player.connect();
      playerRef.current = player;
    };

    if (typeof window !== "undefined") {
      if (window.Spotify) {
        initPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
      }
    }

    return () => {
      playerRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyToken, isPremium]);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem(LS_REFRESH);
    if (!refresh) { disconnectSpotify(); return; }

    try {
      const res = await fetch("/api/spotify/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) { disconnectSpotify(); return; }
      const data = await res.json();
      const expiresAt = Date.now() + data.expires_in * 1000;
      localStorage.setItem(LS_TOKEN, data.access_token);
      localStorage.setItem(LS_EXPIRES, String(expiresAt));
      setSpotifyToken(data.access_token);
    } catch {
      disconnectSpotify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const token = localStorage.getItem(LS_TOKEN);
    const expiresAt = Number(localStorage.getItem(LS_EXPIRES) || 0);
    if (!token) return null;
    if (Date.now() >= expiresAt - 60000) {
      await refreshToken();
      return localStorage.getItem(LS_TOKEN);
    }
    return token;
  }, [refreshToken]);

  const connectSpotify = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem(SS_VERIFIER, verifier);
    window.location.href = buildAuthUrl(challenge);
  }, []);

  const handleCallback = useCallback(async (code: string) => {
    const verifier = sessionStorage.getItem(SS_VERIFIER);
    if (!verifier) return;
    sessionStorage.removeItem(SS_VERIFIER);

    setSpotifyLoading(true);
    try {
      const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!;
      const res = await fetch("/api/spotify/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri }),
      });
      if (!res.ok) throw new Error("Token exchange failed");
      const data = await res.json();
      const expiresAt = Date.now() + data.expires_in * 1000;
      localStorage.setItem(LS_TOKEN, data.access_token);
      localStorage.setItem(LS_REFRESH, data.refresh_token);
      localStorage.setItem(LS_EXPIRES, String(expiresAt));
      setSpotifyToken(data.access_token);
    } catch {
      setSpotifyError("Failed to connect Spotify. Please try again.");
    } finally {
      setSpotifyLoading(false);
    }
  }, []);

  const disconnectSpotify = useCallback(() => {
    playerRef.current?.disconnect();
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_EXPIRES);
    setSpotifyToken(null);
    setSpotifyUser(null);
    setSpotifyPlaylists([]);
    setSpotifyTracks([]);
    setSpotifySearchResults([]);
    setSpotifyDeviceId(null);
    setIsPremium(null);
    setCurrentSpotifyTrack(null);
    setPlaybackMode("local");
    setSdkReady(false);
    playerRef.current = null;
  }, []);

  const playSpotifyTrack = useCallback(async (
    track: SpotifyTrack,
    audioRef: React.MutableRefObject<HTMLAudioElement | null>
  ) => {
    if (!isPremium) {
      setSpotifyError("Spotify Premium is required for playback.");
      return;
    }
    const token = await getValidToken();
    if (!token || !spotifyDeviceId) return;

    // Pause local audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [track.uri] }),
      });
      setCurrentSpotifyTrack(track);
      setPlaybackMode("spotify");
    } catch {
      setSpotifyError("Failed to play track. Make sure Spotify is active.");
    }
  }, [isPremium, getValidToken, spotifyDeviceId]);

  const pauseSpotify = useCallback(() => { playerRef.current?.pause(); }, []);
  const resumeSpotify = useCallback(() => { playerRef.current?.resume(); }, []);
  const nextSpotifyTrack = useCallback(() => { playerRef.current?.nextTrack(); }, []);
  const prevSpotifyTrack = useCallback(() => { playerRef.current?.previousTrack(); }, []);

  const loadPlaylists = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const playlists = await getSpotifyPlaylists(token);
      setSpotifyPlaylists(playlists);
    } catch { setSpotifyError("Failed to load playlists."); }
  }, [getValidToken]);

  const loadPlaylistTracks = useCallback(async (playlistId: string) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const tracks = await getPlaylistTracks(token, playlistId);
      setSpotifyTracks(tracks);
    } catch { setSpotifyError("Failed to load tracks."); }
  }, [getValidToken]);

  const searchSpotify = useCallback(async (query: string) => {
    if (!query.trim()) { setSpotifySearchResults([]); return; }
    const token = await getValidToken();
    if (!token) return;
    try {
      const results = await searchSpotifyTracks(token, query);
      setSpotifySearchResults(results);
    } catch { setSpotifySearchResults([]); }
  }, [getValidToken]);

  const loadLikedSongs = useCallback(async (): Promise<SpotifyTrack[]> => {
    const token = await getValidToken();
    if (!token) return [];
    try { return await getLikedSongs(token); } catch { return []; }
  }, [getValidToken]);

  return {
    spotifyToken, spotifyUser, spotifyPlaylists, spotifyTracks, setSpotifyTracks,
    spotifySearchResults, spotifyDeviceId, isPremium, currentSpotifyTrack,
    playbackMode, setPlaybackMode, sdkReady, spotifyError, setSpotifyError,
    spotifyLoading,
    connectSpotify, disconnectSpotify,
    playSpotifyTrack, pauseSpotify, resumeSpotify,
    nextSpotifyTrack, prevSpotifyTrack,
    loadPlaylists, loadPlaylistTracks, searchSpotify, loadLikedSongs,
  };
}
