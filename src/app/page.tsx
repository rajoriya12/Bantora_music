"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, X, Search, Settings,
  Music2, FolderOpen, Plus, Trash2, ListMusic, Shuffle, Repeat, Layers,
  Compass, Flame, Disc, Volume2, VolumeX, Heart, Maximize2,
  Sparkles, ListPlus
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useSpotify } from "@/hooks/useSpotify";
import type { SpotifyTrack } from "@/lib/spotify";
import { searchYouTubeVideos, type YouTubeVideo } from "@/lib/youtube";

// ── Types ─────────────────────────────────────────────────────────────────────

type Folder = string;

interface MyLibSong {
  id: string;
  name: string;
  size: number;
}

interface MyPlaylist {
  id: string;
  name: string;
  songs: MyLibSong[];
}

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  source: "youtube" | "spotify" | "tape" | "local";
  sourceData?: {
    videoId?: string;
    folder?: string;
    songPath?: string;
    localId?: string;
    playlistId?: string;
  };
}

type ViewMode = "explore" | "studio" | "youtube" | "spotify" | "tapes" | "mylib";

const LS_KEY = "bantora_mylib_v1";

function loadMyLib(): MyPlaylist[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMyLib(playlists: MyPlaylist[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(playlists));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSongName(track: string) {
  let name = track.split("/").pop() || track;
  name = decodeURIComponent(name);
  name = name.replace(/\.mp3$/i, "");
  name = name
    .replace(/\(pagalworldi\.com\.co\)/gi, "")
    .replace(/\(koshalworld\.com\)/gi, "")
    .replace(/\(mp3\.pm\)/gi, "")
    .replace(/HindiRapsong2021/gi, "");
  name = name.replace(/[-_]/g, " ").trim();
  return name || "Unknown Track";
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function cleanFileName(filename: string) {
  let name = filename.replace(/\.[^.]+$/, "");
  name = name.replace(/[-_]/g, " ").trim();
  return name || "Unknown Track";
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Icons & Visualizer Components ─────────────────────────────────────────────

function YoutubeIcon({ className = "w-4 h-4 text-red-500" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function RealtimeEqualizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-6 px-1">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full bg-gradient-to-t from-cyan-400 to-purple-500 ${
            isPlaying ? `eq-bar-${i}` : "h-1.5 opacity-40"
          }`}
          style={{ minHeight: "4px" }}
        />
      ))}
    </div>
  );
}

// ── Main Bantora Application Component ────────────────────────────────────────

export default function MusicPlayer() {
  // ── Setup Spotify SDK ready hook safely ─────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { onSpotifyWebPlaybackSDKReady: () => void }).onSpotifyWebPlaybackSDKReady = () => {};
    }
  }, []);

  // ── Navigation & Views ───────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewMode>("explore");
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [vinylMode, setVinylMode] = useState(true);

  // ── Active Track & Unified Queue ───────────────────────────────────────────
  const [activeTrack, setActiveTrack] = useState<UnifiedTrack | null>(null);
  const [queue, setQueue] = useState<UnifiedTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  // ── Server / Tape folders state ─────────────────────────────────────────────
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderInfo, setFolderInfo] = useState<Record<string, string>>({});
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [folderSongs, setFolderSongs] = useState<string[]>([]);
  const [selectedFolderForViewing, setSelectedFolderForViewing] = useState<string | null>(null);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // ── Playback modes ─────────────────────────────────────────────────────────
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [mixAllMode, setMixAllMode] = useState(false);

  // ── Search & Discover State ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineSearchResults, setOnlineSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  // ── YouTube state ───────────────────────────────────────────────────────────
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("Bollywood Top Trending Songs 2026");
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
  const [showYoutubeVideo, setShowYoutubeVideo] = useState(false);
  // ytVideoId drives the always-mounted iframe — separate from activeTrack to prevent remounts
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);

  // ── Spotify Catalog State ───────────────────────────────────────────────────
  const [spotifyExploreQuery, setSpotifyExploreQuery] = useState("Bollywood Top Hits");
  const [spotifyExploreTracks, setSpotifyExploreTracks] = useState<SpotifyTrack[]>([]);
  const [isSpotifyExploreLoading, setIsSpotifyExploreLoading] = useState(false);

  // ── My Library state ───────────────────────────────────────────────────────
  const [myPlaylists, setMyPlaylists] = useState<MyPlaylist[]>([]);
  const fileStore = useRef<Map<string, File>>(new Map());
  const blobStore = useRef<Map<string, string>>(new Map());
  const [openMyPlaylist, setOpenMyPlaylist] = useState<string | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // ── Spotify integration hook ────────────────────────────────────────────────
  const {
    spotifyToken,
    isPremium,
    spotifyError, setSpotifyError,
    playSpotifyTrack,
  } = useSpotify();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addSongsTargetRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Safe audio coexistence controller ──────────────────────────────────────
  const stopYouTubeIframe = useCallback(() => {
    const iframe = document.getElementById("bantora-youtube-player") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      } catch { /* cross-origin safety */ }
    }
  }, []);

  // ── Unified Play Track Function ────────────────────────────────────────────
  const playTrack = useCallback((track: UnifiedTrack) => {
    setActiveTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);

    if (track.source === "youtube" && track.sourceData?.videoId) {
      // 1. YouTube track: stop HTML5 audio, load new video in persistent iframe
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setYtVideoId(track.sourceData.videoId);
    } else if (track.source === "tape" && track.sourceData?.folder && track.sourceData?.songPath) {
      // 2. Tape track: stop YouTube iframe, play HTML5 Audio
      stopYouTubeIframe();
      const p = track.sourceData.songPath.startsWith("/") ? track.sourceData.songPath.substring(1) : track.sourceData.songPath;
      const src = `/songs/${track.sourceData.folder}/${p}`;
      if (audioRef.current) {
        audioRef.current.src = src;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          // If autoplay blocked, user needs to press play again — state reflects this
          setIsPlaying(false);
        });
      }
    } else if (track.source === "local" && track.sourceData?.localId) {
      // 3. Local file track: stop YouTube, play HTML5 Audio blob
      stopYouTubeIframe();
      const url = blobStore.current.get(track.sourceData.localId);
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
    } else if (track.source === "spotify") {
      stopYouTubeIframe();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [stopYouTubeIframe, isMuted, volume]);

  // Play YouTube Track helper
  const playYoutubeTrack = useCallback((video: YouTubeVideo) => {
    const track: UnifiedTrack = {
      id: `yt-${video.id}`,
      title: video.title,
      artist: video.channelTitle,
      thumbnail: video.thumbnail,
      source: "youtube",
      sourceData: { videoId: video.id },
    };
    playTrack(track);
  }, [playTrack]);

  // Play Spotify Track helper (streams seamlessly via YouTube engine)
  const handlePlaySpotifyTrack = useCallback(async (track: SpotifyTrack) => {
    if (spotifyToken && isPremium) {
      stopYouTubeIframe();
      playSpotifyTrack(track, audioRef);
      return;
    }

    try {
      const artist = track.artists?.map((a) => a.name).join(" ") || "";
      const query = `${track.name} ${artist}`.trim();
      const results = await searchYouTubeVideos(query);
      // Only use results that have a real YouTube videoId (11-char alphanumeric)
      const youtubeResults = results.filter(r => /^[a-zA-Z0-9_-]{11}$/.test(r.id));
      if (youtubeResults.length > 0) {
        const topVideo = youtubeResults[0];
        const unified: UnifiedTrack = {
          id: `sp-${track.id}`,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(", ") || topVideo.channelTitle,
          thumbnail: track.album.images[0]?.url || topVideo.thumbnail,
          source: "youtube",
          sourceData: { videoId: topVideo.id },
        };
        playTrack(unified);
      } else {
        // No YouTube stream available — show informative message
        setSpotifyError("YouTube quota exceeded. Try a different song or wait a few hours.");
      }
    } catch {
      setSpotifyError("Failed to stream track. Please try again.");
    }
  }, [spotifyToken, isPremium, stopYouTubeIframe, playSpotifyTrack, playTrack, setSpotifyError]);

  // ── YouTube API Search ─────────────────────────────────────────────────────
  const searchYouTube = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsYoutubeLoading(true);
    try {
      const results = await searchYouTubeVideos(query);
      setYoutubeVideos(results);
    } catch {
      // Handled in helper
    } finally {
      setIsYoutubeLoading(false);
    }
  }, []);

  const fetchSpotifyExplore = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSpotifyExploreLoading(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks) {
          setSpotifyExploreTracks(data.tracks);
        }
      }
    } catch {
      // Handled
    } finally {
      setIsSpotifyExploreLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    searchYouTube(youtubeSearchQuery);
    fetchSpotifyExplore(spotifyExploreQuery);
  }, [searchYouTube, fetchSpotifyExplore, youtubeSearchQuery, spotifyExploreQuery]);

  // Global search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setOnlineSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }
    setIsSearchingOnline(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tracks) {
            setOnlineSearchResults(data.tracks);
          }
        }
      } catch {
        // Handled
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Next & Previous Track Navigation ───────────────────────────────────────
  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      if (queueIndex < queue.length - 1) {
        const nextIdx = queueIndex + 1;
        setQueueIndex(nextIdx);
        playTrack(queue[nextIdx]);
      } else if (repeatMode === "all") {
        setQueueIndex(0);
        playTrack(queue[0]);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    if (activeTrack?.source === "youtube") {
      const idx = youtubeVideos.findIndex(v => v.id === activeTrack.sourceData?.videoId);
      if (idx >= 0 && idx < youtubeVideos.length - 1) {
        playYoutubeTrack(youtubeVideos[idx + 1]);
      } else if (repeatMode === "all" && youtubeVideos.length > 0) {
        playYoutubeTrack(youtubeVideos[0]);
      } else {
        setIsPlaying(false);
      }
    } else if (activeTrack?.source === "tape" && folderSongs.length > 0) {
      const idx = folderSongs.findIndex(s => s === activeTrack.sourceData?.songPath);
      if (idx >= 0 && idx < folderSongs.length - 1) {
        const nextSong = folderSongs[idx + 1];
        playTrack({
          id: `tape-${currentFolder}-${idx + 1}`,
          title: cleanSongName(nextSong),
          artist: folderInfo[currentFolder] || "Bantora Tape",
          thumbnail: `/songs/${currentFolder}/cover.jpeg`,
          source: "tape",
          sourceData: { folder: currentFolder, songPath: nextSong },
        });
      } else if (repeatMode === "all") {
        playTrack({
          id: `tape-${currentFolder}-0`,
          title: cleanSongName(folderSongs[0]),
          artist: folderInfo[currentFolder] || "Bantora Tape",
          thumbnail: `/songs/${currentFolder}/cover.jpeg`,
          source: "tape",
          sourceData: { folder: currentFolder, songPath: folderSongs[0] },
        });
      } else {
        setIsPlaying(false);
      }
    }
  }, [queue, queueIndex, repeatMode, activeTrack, youtubeVideos, folderSongs, currentFolder, folderInfo, playTrack, playYoutubeTrack]);

  const handlePrev = useCallback(() => {
    if (queue.length > 0 && queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      setQueueIndex(prevIdx);
      playTrack(queue[prevIdx]);
      return;
    }

    if (activeTrack?.source === "youtube") {
      const idx = youtubeVideos.findIndex(v => v.id === activeTrack.sourceData?.videoId);
      if (idx > 0) {
        playYoutubeTrack(youtubeVideos[idx - 1]);
      }
    } else if (activeTrack?.source === "tape" && folderSongs.length > 0) {
      const idx = folderSongs.findIndex(s => s === activeTrack.sourceData?.songPath);
      if (idx > 0) {
        const prevSong = folderSongs[idx - 1];
        playTrack({
          id: `tape-${currentFolder}-${idx - 1}`,
          title: cleanSongName(prevSong),
          artist: folderInfo[currentFolder] || "Bantora Tape",
          thumbnail: `/songs/${currentFolder}/cover.jpeg`,
          source: "tape",
          sourceData: { folder: currentFolder, songPath: prevSong },
        });
      }
    }
  }, [queue, queueIndex, activeTrack, youtubeVideos, folderSongs, currentFolder, folderInfo, playTrack, playYoutubeTrack]);

  // ── Setup Audio Element ────────────────────────────────────────────────────
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onTime = () => { setCurrentTime(audio.currentTime); setDuration(audio.duration || 0); };
    const onEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNextRef.current();
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Load playlists from localStorage
  useEffect(() => {
    setMyPlaylists(loadMyLib());
  }, []);

  // Fetch server folders
  useEffect(() => {
    fetch("/api/admin/folders").then(r => r.json()).then(d => {
      if (d.folders) {
        setFolders(d.folders);
        if (!currentFolder && d.folders.length > 0) {
          setCurrentFolder(d.folders[0]);
        }
      }
    }).catch(() => {});
  }, [currentFolder]);

  useEffect(() => {
    if (!folders.length) return;
    Promise.all(
      folders.map(f =>
        fetch(`/songs/${f}/info.json`)
          .then(r => r.ok ? r.json() : null)
          .then(d => [f, d?.title || d?.tital || f] as [string, string])
          .catch(() => [f, f] as [string, string])
      )
    ).then(entries => setFolderInfo(Object.fromEntries(entries)));
  }, [folders]);

  useEffect(() => {
    if (!currentFolder || currentFolder === "__MIX_ALL__") return;
    fetch(`/songs/${currentFolder}/playlist.json`)
      .then(r => r.ok ? r.json() : [])
      .then((d: string[]) => { setFolderSongs(d); })
      .catch(() => setFolderSongs([]));
  }, [currentFolder]);

  // Play/Pause toggle
  const togglePlay = () => {
    if (!activeTrack) {
      if (youtubeVideos.length > 0) {
        playYoutubeTrack(youtubeVideos[0]);
      } else if (folders.length > 0 && folderSongs.length > 0) {
        playTrack({
          id: `tape-${currentFolder}-${folderSongs[0]}`,
          title: cleanSongName(folderSongs[0]),
          artist: folderInfo[currentFolder] || "Bantora Tape",
          thumbnail: `/songs/${currentFolder}/cover.jpeg`,
          source: "tape",
          sourceData: { folder: currentFolder, songPath: folderSongs[0] },
        });
      }
      return;
    }

    if (activeTrack.source === "youtube") {
      const iframe = document.getElementById("bantora-youtube-player") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        try {
          if (isPlaying) {
            iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
          } else {
            iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
          }
        } catch { /* cross-origin safety */ }
      }
      setIsPlaying(p => !p);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(p => !p);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    const iframe = document.getElementById("bantora-youtube-player") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [val * 100] }), "*");
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const iframe = document.getElementById("bantora-youtube-player") as HTMLIFrameElement;
    if (isMuted) {
      const targetVol = volume || 0.5;
      if (audioRef.current) audioRef.current.volume = targetVol;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [targetVol * 100] }), "*");
      }
      setIsMuted(false);
    } else {
      if (audioRef.current) audioRef.current.volume = 0;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
      }
      setIsMuted(true);
    }
  };

  const toggleShuffle = () => {
    setShuffleMode(s => !s);
  };

  const cycleRepeat = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  const toggleMixAll = () => {
    if (!mixAllMode) {
      const promises = folders.map(folder =>
        fetch(`/songs/${folder}/playlist.json`)
          .then(r => r.ok ? r.json() : [])
          .then((playlist: string[]) => 
            playlist.map(song => ({
              folder,
              song: song.startsWith("/") ? song.substring(1) : song
            }))
          )
          .catch(() => [])
      );

      Promise.all(promises).then(allPlaylists => {
        const megaList: UnifiedTrack[] = [];
        allPlaylists.forEach(folderSongs => {
          folderSongs.forEach(({ folder, song }) => {
            megaList.push({
              id: `mix-${folder}-${song}`,
              title: cleanSongName(song),
              artist: folderInfo[folder] || folder,
              thumbnail: `/songs/${folder}/cover.jpeg`,
              source: "tape",
              sourceData: { folder, songPath: song },
            });
          });
        });

        if (megaList.length > 0) {
          const finalList = shuffleMode ? shuffleArray(megaList) : megaList;
          setQueue(finalList);
          setQueueIndex(0);
          playTrack(finalList[0]);
          setMixAllMode(true);
        }
      });
    } else {
      setMixAllMode(false);
    }
  };

  const addToQueue = (track: UnifiedTrack) => {
    setQueue(q => [...q, track]);
  };

  // ── My Library helpers ─────────────────────────────────────────────────────
  const createPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const pl: MyPlaylist = { id: genId(), name, songs: [] };
    const updated = [...myPlaylists, pl];
    setMyPlaylists(updated);
    saveMyLib(updated);
    setNewPlaylistName("");
    setShowNewPlaylistModal(false);
  };

  const deletePlaylist = (plId: string) => {
    const pl = myPlaylists.find(p => p.id === plId);
    if (pl) {
      pl.songs.forEach(s => {
        const url = blobStore.current.get(s.id);
        if (url) URL.revokeObjectURL(url);
        blobStore.current.delete(s.id);
        fileStore.current.delete(s.id);
      });
    }
    const updated = myPlaylists.filter(p => p.id !== plId);
    setMyPlaylists(updated);
    saveMyLib(updated);
    if (openMyPlaylist === plId) setOpenMyPlaylist(null);
  };

  const deleteSong = (plId: string, songId: string) => {
    const url = blobStore.current.get(songId);
    if (url) URL.revokeObjectURL(url);
    blobStore.current.delete(songId);
    fileStore.current.delete(songId);
    const updated = myPlaylists.map(p =>
      p.id === plId ? { ...p, songs: p.songs.filter(s => s.id !== songId) } : p
    );
    setMyPlaylists(updated);
    saveMyLib(updated);
  };

  const openAddSongs = (plId: string) => {
    addSongsTargetRef.current = plId;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const plId = addSongsTargetRef.current;
    if (!plId || !e.target.files) return;
    const files = Array.from(e.target.files);
    const newSongs: MyLibSong[] = files.map(f => ({
      id: genId(),
      name: cleanFileName(f.name),
      size: f.size,
    }));
    newSongs.forEach((s, i) => {
      fileStore.current.set(s.id, files[i]);
      blobStore.current.set(s.id, URL.createObjectURL(files[i]));
    });
    const updated = myPlaylists.map(p =>
      p.id === plId ? { ...p, songs: [...p.songs, ...newSongs] } : p
    );
    setMyPlaylists(updated);
    saveMyLib(updated);
    e.target.value = "";
  };

  const playMyLibSong = (plId: string, song: MyLibSong) => {
    const track: UnifiedTrack = {
      id: `local-${song.id}`,
      title: song.name,
      artist: myPlaylists.find(p => p.id === plId)?.name || "My Library",
      thumbnail: "/logo.png",
      source: "local",
      sourceData: { localId: song.id, playlistId: plId },
    };
    playTrack(track);
  };

  // Derived active track details
  const displayTitle = activeTrack?.title || (folderSongs.length > 0 ? cleanSongName(folderSongs[0]) : "Select a track");
  const displayArtist = activeTrack?.artist || (folderInfo[currentFolder] || "Bantora");
  const displayCover = activeTrack?.thumbnail || (currentFolder ? `/songs/${currentFolder}/cover.jpeg` : "/logo.png");
  const displayBadge = (activeTrack?.source || "OFFLINE").toUpperCase();
  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const openedPlaylist = myPlaylists.find(p => p.id === openMyPlaylist);

  // Spotlight Track for Hero Banner
  const heroTrack = youtubeVideos[0] || {
    id: "hero",
    title: "Trending Music & Chartbusters",
    channelTitle: "Bantora Cyber Studio",
    thumbnail: "/logo.png",
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070b] text-white flex flex-col font-sans select-none">

      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* ── Modal: New Playlist ───────────────────────────────────────────── */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowNewPlaylistModal(false)} />
          <div className="relative bg-[#0c1017] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" /> Create Playlist
              </h3>
              <button onClick={() => setShowNewPlaylistModal(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Cyber Vibes, Late Night..."
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlaylist(); }}
              className="bg-white/5 border border-white/10 focus:border-cyan-400/60 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createPlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold btn-cyber-primary disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main App Layout: Sidebar + Content Hub ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── Left Sidebar (Cyber Navigation Hub) ─────────────────────────── */}
        <aside className="w-64 lg:w-72 bg-[#080a0f] border-r border-white/[0.06] flex flex-col shrink-0 z-20">
          
          {/* Brand Header */}
          <div className="px-6 py-6 flex items-center gap-3 border-b border-white/[0.05]">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-[2px] shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#080a0f] rounded-[10px] flex items-center justify-center">
                <Disc className="w-5 h-5 text-cyan-400 animate-spin-slow" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-400">
                BANTORA
              </h1>
              <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase">Universal Music Hub</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 hide-scrollbar">
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Discovery</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveView("explore")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "explore"
                      ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  Explore & Trending
                </button>

                <button
                  onClick={() => setActiveView("studio")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "studio"
                      ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Audiophile Studio
                </button>
              </nav>
            </div>

            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Online Engines</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveView("youtube")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "youtube"
                      ? "bg-red-500/15 text-red-300 border border-red-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <YoutubeIcon className="w-4 h-4 text-red-500" />
                    <span>YouTube Music</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">LIVE</span>
                </button>

                <button
                  onClick={() => setActiveView("spotify")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "spotify"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Music2 className="w-4 h-4 text-emerald-400" />
                    <span>Spotify Catalog</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">API</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Local & Tapes</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveView("tapes")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "tapes"
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Disc className="w-4 h-4 text-purple-400" />
                    <span>Bantora Tapes</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{folders.length}</span>
                </button>

                <button
                  onClick={() => setActiveView("mylib")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeView === "mylib"
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                    <span>My Library</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{myPlaylists.length}</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Sidebar Footer (Status & Settings) */}
          <div className="p-4 border-t border-white/[0.05] bg-[#07090d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-white/40">READY TO STREAM</span>
            </div>
            <Link
              href="/admin"
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              title="Admin Panel"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </aside>

        {/* ── Center Content Hub ──────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-oled">
          
          {/* Top Glass Search & Action Header */}
          <header className="h-20 px-8 flex items-center justify-between border-b border-white/[0.05] bg-[#07090d]/80 backdrop-blur-xl shrink-0 z-10">
            
            {/* Global Search Bar */}
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] focus-within:border-cyan-400/50 rounded-2xl px-4 py-2.5 w-full max-w-lg transition-all">
              <Search className="w-4 h-4 text-white/40 shrink-0" />
              <input
                type="text"
                placeholder="Search millions of songs, artists, videos..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-white placeholder:text-white/30 w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMixAll}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                  mixAllMode
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white"
                }`}
                title="Mix all tape tracks"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mix All Tapes</span>
              </button>

              <button
                onClick={() => setShowQueueDrawer(q => !q)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showQueueDrawer
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white"
                }`}
                title="Unified Queue"
              >
                <ListMusic className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ── Content View Router ───────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-8 py-8 hide-scrollbar">

            {/* 1. Global Search Results Overlay */}
            {searchQuery && (
              <section className="mb-10 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Search className="w-5 h-5 text-cyan-400" />
                    Search Results for &ldquo;{searchQuery}&rdquo;
                  </h2>
                  {isSearchingOnline && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {onlineSearchResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-oled-card hover:bg-white/[0.08] transition-all group"
                    >
                      <img
                        src={track.album.images[1]?.url ?? track.album.images[0]?.url ?? "/logo.png"}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <button
                        onClick={() => handlePlaySpotifyTrack(track)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-xs font-semibold truncate text-white/90 group-hover:text-cyan-300">
                          {track.name}
                        </p>
                        <p className="text-[11px] text-white/40 truncate mt-0.5">
                          {track.artists.map(a => a.name).join(", ")}
                        </p>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePlaySpotifyTrack(track)}
                          className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center hover:bg-cyan-500/40"
                          title="Play Track"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                        <button
                          onClick={() => addToQueue({
                            id: `sp-${track.id}`,
                            title: track.name,
                            artist: track.artists.map(a => a.name).join(", "),
                            thumbnail: track.album.images[0]?.url || "/logo.png",
                            source: "youtube",
                          })}
                          className="w-8 h-8 rounded-full bg-white/5 text-white/40 hover:text-white flex items-center justify-center"
                          title="Add to Queue"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. EXPLORE & TRENDING VIEW ──────────────────────────────────── */}
            {activeView === "explore" && !searchQuery && (
              <div className="space-y-10 animate-fade-in">
                
                {/* Hero Featured Banner */}
                <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-r from-purple-950/40 via-[#0a0d16] to-[#04060a] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
                  <div className="flex-1 space-y-4 text-center md:text-left z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold tracking-widest uppercase">
                      <Flame className="w-3 h-3 text-cyan-400" /> Trending Spotlight
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
                      {heroTrack.title}
                    </h2>
                    <p className="text-xs md:text-sm text-white/60 max-w-md">
                      Stream top trending chartbusters on YouTube & Spotify with lossless audio rendering.
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                      <button
                        onClick={() => {
                          if (youtubeVideos[0]) playYoutubeTrack(youtubeVideos[0]);
                        }}
                        className="px-6 py-3 rounded-2xl text-xs font-bold text-white btn-cyber-primary flex items-center gap-2 shadow-lg"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Listen Now
                      </button>
                      <button
                        onClick={() => setActiveView("studio")}
                        className="px-5 py-3 rounded-2xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-all flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Studio Mode
                      </button>
                    </div>
                  </div>

                  <div className="relative w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                    <img
                      src={heroTrack.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>
                </div>

                {/* Genre Quick Filter Chips */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Moods & Genres</p>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    {[
                      "Bollywood Hits", "Punjabi Pop", "Lofi Beats", "Arijit Singh",
                      "Indian Hip Hop", "Coke Studio", "Global Top 50", "EDM Vibes", "Late Night Chill"
                    ].map((genre) => (
                      <button
                        key={genre}
                        onClick={() => {
                          setYoutubeSearchQuery(genre);
                          searchYouTube(genre);
                          setActiveView("youtube");
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.07] hover:border-cyan-400/40 hover:bg-cyan-500/10 text-white/70 hover:text-cyan-300 transition-all shrink-0"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* YouTube Trending Hits Carousel */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <YoutubeIcon className="w-5 h-5 text-red-500" />
                      <h3 className="text-lg font-bold">Trending on YouTube</h3>
                    </div>
                    <button onClick={() => setActiveView("youtube")} className="text-xs text-white/40 hover:text-cyan-400 transition-colors">
                      View all →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {youtubeVideos.slice(0, 6).map((video) => (
                      <div
                        key={video.id}
                        className="group bg-oled-card rounded-2xl p-3 flex flex-col text-left transition-all hover:-translate-y-1.5 relative"
                      >
                        <div
                          onClick={() => playYoutubeTrack(video)}
                          className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black cursor-pointer"
                        >
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <p
                          onClick={() => playYoutubeTrack(video)}
                          className="text-xs font-semibold text-white/90 group-hover:text-red-400 truncate leading-tight cursor-pointer"
                        >
                          {video.title}
                        </p>
                        <p className="text-[10px] text-white/40 truncate mt-1">
                          {video.channelTitle}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spotify Global Top Charts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music2 className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-bold">Spotify Hits</h3>
                    </div>
                    <button onClick={() => setActiveView("spotify")} className="text-xs text-white/40 hover:text-emerald-400 transition-colors">
                      View all →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {spotifyExploreTracks.slice(0, 6).map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-oled-card hover:bg-white/[0.08] transition-all text-left group"
                      >
                        <img
                          src={track.album.images[1]?.url ?? track.album.images[0]?.url ?? "/logo.png"}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        <button
                          onClick={() => handlePlaySpotifyTrack(track)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-xs font-semibold truncate text-white/90 group-hover:text-emerald-300">
                            {track.name}
                          </p>
                          <p className="text-[11px] text-white/40 truncate mt-0.5">
                            {track.artists.map(a => a.name).join(", ")}
                          </p>
                        </button>
                        <button
                          onClick={() => handlePlaySpotifyTrack(track)}
                          className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold shrink-0 hover:bg-emerald-500/40"
                        >
                          PLAY
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. AUDIOPHILE STUDIO IMMERSION VIEW (Style 3 Minimalist OLED) ── */}
            {activeView === "studio" && (
              <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in py-6">
                
                {/* Audio Specs Badges */}
                <div className="flex items-center gap-2 mb-8">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                    24-BIT / 96kHz LOSSLESS
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    320 KBPS HI-RES
                  </span>
                  <button
                    onClick={() => setVinylMode(v => !v)}
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all ${
                      vinylMode ? "bg-white/10 border-white/30 text-white" : "text-white/40 border-white/10"
                    }`}
                  >
                    {vinylMode ? "VINYL DISC ON" : "VINYL DISC OFF"}
                  </button>
                </div>

                {/* Main Album Artwork / Vinyl Turntable */}
                <div className="relative mb-8 group">
                  {vinylMode ? (
                    <div
                      className={`w-64 h-64 md:w-80 md:h-80 rounded-full vinyl-disc p-3 flex items-center justify-center shadow-[0_20px_80px_rgba(0,0,0,0.95)] transition-all ${
                        isPlaying ? "animate-vinyl-spin" : ""
                      }`}
                    >
                      <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-white/20 shadow-inner">
                        <img
                          src={displayCover}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black border border-white/30" />
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_80px_rgba(168,85,247,0.25)]">
                      <img
                        src={displayCover}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Track Metadata */}
                <div className="space-y-2 max-w-lg mb-6">
                  <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white line-clamp-2">
                    {displayTitle}
                  </h1>
                  <p className="text-xs md:text-sm text-cyan-400 font-semibold tracking-widest uppercase">
                    {displayArtist}
                  </p>
                </div>

                {/* Live Realtime Equalizer Bars */}
                <div className="mb-4">
                  <RealtimeEqualizer isPlaying={isPlaying} />
                </div>
              </div>
            )}

            {/* 4. YOUTUBE MUSIC VIEW ───────────────────────────────────────── */}
            {activeView === "youtube" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <YoutubeIcon className="w-6 h-6 text-red-500" /> YouTube Music Hub
                    </h2>
                    <p className="text-xs text-white/40 mt-1">Search & stream millions of songs, live concerts, and official music videos.</p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      searchYouTube(youtubeSearchQuery);
                    }}
                    className="flex items-center gap-2 bg-white/5 border border-red-500/20 rounded-2xl px-4 py-2 w-full max-w-md"
                  >
                    <Search className="w-4 h-4 text-red-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search songs, artists on YouTube..."
                      value={youtubeSearchQuery}
                      onChange={e => setYoutubeSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs text-white w-full"
                    />
                    <button type="submit" className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-xl">
                      Search
                    </button>
                  </form>
                </div>

                {isYoutubeLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-white/40">Fetching YouTube audio streams...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {youtubeVideos.map((video) => {
                      const isCurrent = activeTrack?.sourceData?.videoId === video.id;
                      return (
                        <div
                          key={video.id}
                          className={`group p-3 rounded-2xl text-left transition-all flex flex-col ${
                            isCurrent
                              ? "bg-red-500/15 border border-red-500/40 shadow-lg shadow-red-500/10"
                              : "bg-oled-card hover:-translate-y-1"
                          }`}
                        >
                          <div
                            onClick={() => playYoutubeTrack(video)}
                            className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black cursor-pointer"
                          >
                            <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-6 h-6 fill-red-500 text-red-500" />
                            </div>
                          </div>
                          <p
                            onClick={() => playYoutubeTrack(video)}
                            className={`text-xs font-semibold truncate leading-tight cursor-pointer ${isCurrent ? "text-red-300" : "text-white/90 group-hover:text-red-400"}`}
                          >
                            {video.title}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[11px] text-white/40 truncate">
                              {video.channelTitle}
                            </p>
                            <button
                              onClick={() => addToQueue({
                                id: `yt-${video.id}`,
                                title: video.title,
                                artist: video.channelTitle,
                                thumbnail: video.thumbnail,
                                source: "youtube",
                                sourceData: { videoId: video.id }
                              })}
                              className="text-white/30 hover:text-white p-1"
                              title="Add to queue"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 5. SPOTIFY CATALOG VIEW ─────────────────────────────────────── */}
            {activeView === "spotify" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Music2 className="w-6 h-6 text-emerald-400" /> Spotify Catalog
                    </h2>
                    <p className="text-xs text-white/40 mt-1">Direct API music discovery. Play any song without requiring Spotify Premium login.</p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      fetchSpotifyExplore(spotifyExploreQuery);
                    }}
                    className="flex items-center gap-2 bg-white/5 border border-emerald-500/20 rounded-2xl px-4 py-2 w-full max-w-md"
                  >
                    <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search songs, artists on Spotify..."
                      value={spotifyExploreQuery}
                      onChange={e => setSpotifyExploreQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs text-white w-full"
                    />
                    <button type="submit" className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
                      Search
                    </button>
                  </form>
                </div>

                {isSpotifyExploreLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-white/40">Loading Spotify catalog...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {spotifyExploreTracks.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-oled-card hover:bg-white/[0.08] transition-all text-left group"
                      >
                        <img
                          src={track.album.images[1]?.url ?? track.album.images[0]?.url ?? "/logo.png"}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        <button
                          onClick={() => handlePlaySpotifyTrack(track)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-xs font-semibold truncate text-white/90 group-hover:text-emerald-300">
                            {track.name}
                          </p>
                          <p className="text-[11px] text-white/40 truncate mt-0.5">
                            {track.artists.map(a => a.name).join(", ")}
                          </p>
                        </button>
                        <button
                          onClick={() => handlePlaySpotifyTrack(track)}
                          className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold shrink-0 hover:bg-emerald-500/40"
                        >
                          PLAY
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. BANTORA TAPES VIEW (Local Album View with Song Expansion) ─── */}
            {activeView === "tapes" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Disc className="w-6 h-6 text-purple-400" /> Bantora Cassette Tapes
                  </h2>
                  <p className="text-xs text-white/40 mt-1">Curated local albums & tapes with direct song selection.</p>
                </div>

                {/* Selected Tape detail view */}
                {selectedFolderForViewing ? (
                  <div className="bg-oled-card rounded-3xl p-6 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-4">
                        <img
                          src={`/songs/${selectedFolderForViewing}/cover.jpeg`}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                          alt=""
                          className="w-16 h-16 rounded-2xl object-cover"
                        />
                        <div>
                          <button onClick={() => setSelectedFolderForViewing(null)} className="text-xs text-purple-400 hover:underline mb-1">
                            ← Back to all Tapes
                          </button>
                          <h3 className="text-xl font-bold">{folderInfo[selectedFolderForViewing] || selectedFolderForViewing}</h3>
                          <p className="text-xs text-white/40">{folderSongs.length} tracks</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (folderSongs.length > 0) {
                            playTrack({
                              id: `tape-${selectedFolderForViewing}-0`,
                              title: cleanSongName(folderSongs[0]),
                              artist: folderInfo[selectedFolderForViewing] || "Bantora Tape",
                              thumbnail: `/songs/${selectedFolderForViewing}/cover.jpeg`,
                              source: "tape",
                              sourceData: { folder: selectedFolderForViewing, songPath: folderSongs[0] },
                            });
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold btn-cyber-primary flex items-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" /> Play Tape
                      </button>
                    </div>

                    <div className="space-y-1">
                      {folderSongs.map((song, idx) => {
                        const isCurrent = activeTrack?.sourceData?.songPath === song;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isCurrent ? "bg-purple-500/15 border border-purple-500/30" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <button
                              onClick={() => playTrack({
                                id: `tape-${selectedFolderForViewing}-${idx}`,
                                title: cleanSongName(song),
                                artist: folderInfo[selectedFolderForViewing] || "Bantora Tape",
                                thumbnail: `/songs/${selectedFolderForViewing}/cover.jpeg`,
                                source: "tape",
                                sourceData: { folder: selectedFolderForViewing, songPath: song },
                              })}
                              className="w-6 h-6 flex items-center justify-center text-xs font-mono text-white/40 hover:text-purple-400"
                            >
                              {isCurrent && isPlaying ? <RealtimeEqualizer isPlaying /> : idx + 1}
                            </button>
                            <button
                              onClick={() => playTrack({
                                id: `tape-${selectedFolderForViewing}-${idx}`,
                                title: cleanSongName(song),
                                artist: folderInfo[selectedFolderForViewing] || "Bantora Tape",
                                thumbnail: `/songs/${selectedFolderForViewing}/cover.jpeg`,
                                source: "tape",
                                sourceData: { folder: selectedFolderForViewing, songPath: song },
                              })}
                              className="flex-1 text-left min-w-0"
                            >
                              <span className={`text-xs font-medium truncate block ${isCurrent ? "text-purple-300" : "text-white/80"}`}>
                                {cleanSongName(song)}
                              </span>
                            </button>
                            <button
                              onClick={() => addToQueue({
                                id: `tape-${selectedFolderForViewing}-${idx}`,
                                title: cleanSongName(song),
                                artist: folderInfo[selectedFolderForViewing] || "Bantora Tape",
                                thumbnail: `/songs/${selectedFolderForViewing}/cover.jpeg`,
                                source: "tape",
                                sourceData: { folder: selectedFolderForViewing, songPath: song },
                              })}
                              className="p-1 text-white/30 hover:text-white"
                              title="Add to queue"
                            >
                              <ListPlus className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {folders.map(folder => {
                      const active = folder === currentFolder && activeTrack?.source === "tape";
                      return (
                        <div
                          key={folder}
                          className={`group bg-oled-card rounded-2xl p-3 flex flex-col text-left transition-all hover:-translate-y-1 ${
                            active ? "border-purple-500/60 ring-2 ring-purple-500/20" : ""
                          }`}
                        >
                          <div
                            onClick={() => {
                              setCurrentFolder(folder);
                              setSelectedFolderForViewing(folder);
                            }}
                            className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-black cursor-pointer"
                          >
                            <img
                              src={`/songs/${folder}/cover.jpeg`}
                              onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-6 h-6 fill-purple-400 text-purple-400" />
                            </div>
                          </div>
                          <p
                            onClick={() => {
                              setCurrentFolder(folder);
                              setSelectedFolderForViewing(folder);
                            }}
                            className="text-xs font-semibold text-white/90 truncate cursor-pointer"
                          >
                            {folderInfo[folder] || folder}
                          </p>
                          <p className="text-[10px] text-purple-400/80 font-mono mt-0.5">TAPE ALBUM</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 7. MY LIBRARY VIEW (Local User Files) ───────────────────────── */}
            {activeView === "mylib" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <FolderOpen className="w-6 h-6 text-cyan-400" /> My Library
                    </h2>
                    <p className="text-xs text-white/40 mt-1">Create playlists and add your personal audio files.</p>
                  </div>
                  <button
                    onClick={() => setShowNewPlaylistModal(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold btn-cyber-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> New Playlist
                  </button>
                </div>

                {openMyPlaylist && openedPlaylist ? (
                  <div className="bg-oled-card rounded-3xl p-6 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                      <div>
                        <button onClick={() => setOpenMyPlaylist(null)} className="text-xs text-cyan-400 hover:underline mb-1">
                          ← Back to Playlists
                        </button>
                        <h3 className="text-xl font-bold">{openedPlaylist.name}</h3>
                        <p className="text-xs text-white/40">{openedPlaylist.songs.length} songs</p>
                      </div>
                      <button
                        onClick={() => openAddSongs(openedPlaylist.id)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Songs
                      </button>
                    </div>

                    <div className="space-y-1">
                      {openedPlaylist.songs.map((song, idx) => {
                        const isCurrent = activeTrack?.sourceData?.localId === song.id;
                        const hasBlob = blobStore.current.has(song.id);
                        return (
                          <div
                            key={song.id}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isCurrent ? "bg-cyan-500/15 border border-cyan-500/30" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <button
                              onClick={() => hasBlob && playMyLibSong(openedPlaylist.id, song)}
                              className="w-6 h-6 flex items-center justify-center text-xs font-mono text-white/40 hover:text-cyan-400"
                            >
                              {isCurrent && isPlaying ? <RealtimeEqualizer isPlaying /> : idx + 1}
                            </button>
                            <span className="flex-1 text-xs font-medium truncate">{song.name}</span>
                            <button
                              onClick={() => deleteSong(openedPlaylist.id, song.id)}
                              className="text-white/20 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {myPlaylists.map(pl => (
                      <div
                        key={pl.id}
                        className="p-5 rounded-2xl bg-oled-card flex items-center justify-between group"
                      >
                        <button onClick={() => setOpenMyPlaylist(pl.id)} className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-white/90 group-hover:text-cyan-300">{pl.name}</p>
                          <p className="text-xs text-white/40 mt-1">{pl.songs.length} songs</p>
                        </button>
                        <button onClick={() => deletePlaylist(pl.id)} className="text-white/20 hover:text-red-400 p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ── Up Next / Unified Queue Slide-over Drawer ──────────────────── */}
        {showQueueDrawer && (
          <aside className="w-80 bg-[#080a0f] border-l border-white/[0.06] flex flex-col shrink-0 z-20 animate-fade-in">
            <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Unified Queue</h3>
              <button onClick={() => setShowQueueDrawer(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-2">Now Playing</p>
              <div className="flex items-center gap-3">
                <img src={displayCover} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-white">{displayTitle}</p>
                  <p className="text-[11px] text-white/40 truncate">{displayArtist}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 hide-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Up Next ({queue.length || youtubeVideos.length})</p>
                {queue.length > 0 && (
                  <button onClick={() => setQueue([])} className="text-[10px] text-white/30 hover:text-red-400">
                    Clear Queue
                  </button>
                )}
              </div>

              {queue.length > 0 ? (
                queue.map((track, idx) => (
                  <button
                    key={track.id + idx}
                    onClick={() => {
                      setQueueIndex(idx);
                      playTrack(track);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left group transition-all ${
                      idx === queueIndex ? "bg-cyan-500/15 border border-cyan-500/30" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-white/30 w-4 shrink-0">{idx + 1}</span>
                    <img src={track.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-white/80 group-hover:text-cyan-300">{track.title}</p>
                      <p className="text-[10px] text-white/40 truncate">{track.artist}</p>
                    </div>
                  </button>
                ))
              ) : (
                youtubeVideos.slice(0, 10).map((video, idx) => (
                  <button
                    key={video.id}
                    onClick={() => playYoutubeTrack(video)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] text-left group transition-all"
                  >
                    <span className="text-[10px] font-mono text-white/30 w-4 shrink-0">{idx + 1}</span>
                    <img src={video.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-white/80 group-hover:text-cyan-300">{video.title}</p>
                      <p className="text-[10px] text-white/40 truncate">{video.channelTitle}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Bottom Docked Floating Audiophile Player Bar ───────────────────── */}
      <footer className="h-24 bg-[#07090e]/95 backdrop-blur-2xl border-t border-white/[0.08] px-6 flex items-center justify-between shrink-0 z-30 shadow-2xl">
        
        {/* Left: Track Information */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 group cursor-pointer" onClick={() => setActiveView("studio")}>
            <img
              src={displayCover}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold truncate text-white leading-tight">
                {displayTitle}
              </h4>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 shrink-0 font-semibold">
                {displayBadge}
              </span>
            </div>
            <p className="text-[11px] text-white/40 truncate mt-0.5">
              {displayArtist}
            </p>
          </div>

          <button
            onClick={() => setIsLiked(l => !l)}
            className={`p-2 rounded-full transition-colors ${
              isLiked ? "text-pink-500 fill-pink-500" : "text-white/30 hover:text-white"
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Center: Main Playback Controls & Precision Seeker */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-4">
          
          {/* Action Buttons */}
          <div className="flex items-center gap-6">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full transition-all ${
                shuffleMode ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-white/40 hover:text-white"
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={handlePrev}
              className="text-white/60 hover:text-white transition-all hover:scale-110"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Glowing Cyber Play Button */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full btn-cyber-primary flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:scale-110 active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white text-white" />
              ) : (
                <Play className="w-5 h-5 fill-white text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              className="text-white/60 hover:text-white transition-all hover:scale-110"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-1.5 rounded-full relative transition-all ${
                repeatMode !== "off" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-white/40 hover:text-white"
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              <Repeat className="w-4 h-4" />
              {repeatMode === "one" && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full flex items-center justify-center text-[7px] font-bold text-black">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Micro-Scrubber Bar */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/40 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white/40 w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Sound Volume & Mode Tools */}
        <div className="flex items-center justify-end gap-4 w-1/4 min-w-[200px]">
          
          {/* Mini Realtime Equalizer preview */}
          <div className="hidden lg:block">
            <RealtimeEqualizer isPlaying={isPlaying} />
          </div>

          {/* YouTube Video Dock Toggle */}
          {activeTrack?.source === "youtube" && (
            <button
              onClick={() => setShowYoutubeVideo(v => !v)}
              className={`p-2 rounded-xl border transition-all ${
                showYoutubeVideo ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              }`}
              title="Toggle Video Player"
            >
              <YoutubeIcon className="w-4 h-4" />
            </button>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/10 rounded-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Fullscreen Immersion Switch */}
          <button
            onClick={() => setActiveView(activeView === "studio" ? "explore" : "studio")}
            className={`p-2 rounded-xl border transition-all ${
              activeView === "studio" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
            }`}
            title="Studio Immersion Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ── YouTube Stream Engine: Always mounted, never remounts, driven by ytVideoId ── */}
      <div
        className={
          showYoutubeVideo && ytVideoId
            ? "fixed z-40 bottom-28 right-6 w-80 md:w-96 h-52 md:h-60 rounded-2xl overflow-hidden shadow-2xl border border-red-500/40 bg-black/95 backdrop-blur-2xl transition-all"
            : "fixed -bottom-[9999px] -right-[9999px] w-1 h-1 opacity-0 pointer-events-none"
        }
      >
        <div className="relative w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-black/90 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <YoutubeIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-[11px] font-semibold text-white truncate max-w-[200px]">
                {activeTrack?.title || "YouTube"}
              </span>
            </div>
            <button
              onClick={() => setShowYoutubeVideo(false)}
              className="p-1 rounded text-white/50 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 w-full relative">
            {/* Persistent iframe — src only changes when ytVideoId changes, preventing full remounts */}
            {ytVideoId && (
              <iframe
                key={ytVideoId}
                id="bantora-youtube-player"
                src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-none"
                title={activeTrack?.title || "YouTube Player"}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Spotify error toast ──────────────────────────────────────────────── */}
      {spotifyError && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] bg-red-500/90 backdrop-blur-md text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
          <span>{spotifyError}</span>
          <button onClick={() => setSpotifyError(null)} className="text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Spotify Web Playback SDK (conditional) ───────────────────────────── */}
      {spotifyToken && (
        <Script src="https://sdk.scdn.co/spotify-player.js" strategy="lazyOnload" />
      )}
    </div>
  );
}
