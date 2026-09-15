"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Library, X, Search, Settings,
  Music2, FolderOpen, Plus, Trash2, ListMusic, Shuffle, Repeat, Layers,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Song = string;
type Folder = string;

interface MyLibSong {
  id: string;
  name: string;  // display name
  size: number;  // bytes — used to identify the file
  // blobUrl is runtime-only, not persisted
}

interface MyPlaylist {
  id: string;
  name: string;
  songs: MyLibSong[];
}

// Persisted shape (no blobUrls)
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
  let name = filename.replace(/\.[^.]+$/, ""); // strip extension
  name = name.replace(/[-_]/g, " ").trim();
  return name || "Unknown Track";
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Waveform component ────────────────────────────────────────────────────────

function Waveform() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full bg-purple-400 wave-bar-${i}`}
          style={{ minHeight: "4px" }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MusicPlayer() {
  // ── Server playlists state ─────────────────────────────────────────────────
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [folderInfo, setFolderInfo] = useState<Record<string, string>>({});
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [songs, setSongs]           = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);

  // ── Playback modes ─────────────────────────────────────────────────────────
  const [shuffleMode, setShuffleMode] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [mixAllMode, setMixAllMode] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"playlists" | "mylib">("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [trackKey, setTrackKey]     = useState(0);

  // ── My Library state ───────────────────────────────────────────────────────
  const [myPlaylists, setMyPlaylists] = useState<MyPlaylist[]>([]);
  // runtime File objects keyed by song id — not persisted
  const fileStore = useRef<Map<string, File>>(new Map());
  // runtime blobUrls keyed by song id — not persisted
  const blobStore = useRef<Map<string, string>>(new Map());

  // which my-lib playlist is open (null = list view)
  const [openMyPlaylist, setOpenMyPlaylist] = useState<string | null>(null);
  // currently playing my-lib song context
  const [myLibSongId, setMyLibSongId] = useState<string | null>(null);
  const [myLibPlaylistId, setMyLibPlaylistId] = useState<string | null>(null);

  // modal state
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addSongsTargetRef = useRef<string | null>(null); // playlist id

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Audio engine ───────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (myLibSongId && myLibPlaylistId) {
      // advance in my-lib playlist
      const pl = myPlaylists.find(p => p.id === myLibPlaylistId);
      if (!pl) return;
      const idx = pl.songs.findIndex(s => s.id === myLibSongId);
      if (idx < pl.songs.length - 1) {
        const nextSong = pl.songs[idx + 1];
        const url = blobStore.current.get(nextSong.id);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
          setMyLibSongId(nextSong.id);
          setTrackKey(k => k + 1);
          setCoverLoaded(false);
        }
      } else {
        // End of my-lib playlist
        if (repeatMode === "all") {
          // Loop back to first song
          const firstSong = pl.songs[0];
          const url = blobStore.current.get(firstSong.id);
          if (url && audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play().catch(() => {});
            setMyLibSongId(firstSong.id);
            setTrackKey(k => k + 1);
            setCoverLoaded(false);
          }
        } else {
          setIsPlaying(false);
        }
      }
    } else {
      // Server playlist navigation with shuffle support
      const maxIndex = songs.length - 1;
      
      if (shuffleMode && shuffledIndices.length > 0) {
        // Find current position in shuffled order
        const shuffledPos = shuffledIndices.indexOf(currentSongIndex);
        
        if (shuffledPos < shuffledIndices.length - 1) {
          // Move to next in shuffled order
          setCurrentSongIndex(shuffledIndices[shuffledPos + 1]);
        } else {
          // Reached end of shuffle
          if (repeatMode === "all") {
            // Re-shuffle and start over
            const newShuffled = shuffleArray(Array.from({ length: songs.length }, (_, i) => i));
            setShuffledIndices(newShuffled);
            setCurrentSongIndex(newShuffled[0]);
          } else {
            setIsPlaying(false);
          }
        }
      } else {
        // Sequential playback
        if (currentSongIndex < maxIndex) {
          setCurrentSongIndex(i => i + 1);
        } else {
          // Reached end
          if (repeatMode === "all") {
            setCurrentSongIndex(0);
          } else {
            setIsPlaying(false);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLibSongId, myLibPlaylistId, myPlaylists, currentSongIndex, songs, shuffleMode, shuffledIndices, repeatMode]);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;
    const onTime  = () => { setCurrentTime(audio.currentTime); setDuration(audio.duration || 0); };
    const onEnded = () => handleNext();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ended handler up to date without recreating Audio
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const onEnded = () => {
      // Repeat One: replay current song
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNext();
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [handleNext, repeatMode]);

  // ── Load my lib from localStorage ─────────────────────────────────────────
  useEffect(() => {
    setMyPlaylists(loadMyLib());
  }, []);

  // ── Fetch server folders ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/folders").then(r => r.json()).then(d => {
      if (d.folders) {
        setFolders(d.folders);
        if (!currentFolder && d.folders.length > 0) setCurrentFolder(d.folders[0]);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .then((d: string[]) => { setSongs(d); setCurrentSongIndex(0); })
      .catch(() => setSongs([]));
  }, [currentFolder]);

  // ── Audio source update (server songs) ────────────────────────────────────
  useEffect(() => {
    if (!songs.length || !audioRef.current) return;
    if (myLibSongId) return; // currently playing a my-lib song — don't override
    
    let src = "";
    let p = songs[currentSongIndex];
    
    if (mixAllMode || currentFolder === "__MIX_ALL__") {
      // Mix mode - song already has full path like "/folder/song.mp3"
      src = `/songs${p}`;
    } else if (currentFolder) {
      // Normal mode - construct path
      if (p.startsWith("/")) p = p.substring(1);
      src = `/songs/${currentFolder}/${p}`;
    } else {
      return;
    }
    
    if (!audioRef.current.src.endsWith(src.replace(/ /g, "%20"))) {
      audioRef.current.src = src;
      setCurrentTime(0);
      setCoverLoaded(false);
      setTrackKey(k => k + 1);
      // Always auto-play next song unless we explicitly stopped (reached playlist end)
      audioRef.current.play().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongIndex, songs, currentFolder, mixAllMode]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play().catch(() => {}); }
    setIsPlaying(p => !p);
  };

  const handlePrev = () => {
    if (myLibSongId && myLibPlaylistId) {
      const pl = myPlaylists.find(p => p.id === myLibPlaylistId);
      if (!pl) return;
      const idx = pl.songs.findIndex(s => s.id === myLibSongId);
      if (idx > 0) {
        const prevSong = pl.songs[idx - 1];
        const url = blobStore.current.get(prevSong.id);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
          setMyLibSongId(prevSong.id);
          setTrackKey(k => k + 1);
          setCoverLoaded(false);
        }
      }
    } else {
      if (currentSongIndex > 0) setCurrentSongIndex(i => i - 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  // ── Playback mode controls ─────────────────────────────────────────────────
  const toggleShuffle = () => {
    if (!shuffleMode) {
      // Turning shuffle ON
      const indices = Array.from({ length: songs.length }, (_, i) => i);
      const shuffled = shuffleArray(indices);
      setShuffledIndices(shuffled);
      setShuffleMode(true);
    } else {
      // Turning shuffle OFF
      setShuffledIndices([]);
      setShuffleMode(false);
    }
  };

  const cycleRepeat = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  const toggleMixAll = () => {
    if (!mixAllMode) {
      // Turning Mix All ON - combine all server playlists
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
        const megaPlaylist: Song[] = [];
        allPlaylists.forEach(folderSongs => {
          folderSongs.forEach(({ folder, song }) => {
            // Store songs with folder prefix for later playback
            megaPlaylist.push(`/${folder}/${song}`);
          });
        });

        if (megaPlaylist.length > 0) {
          setSongs(megaPlaylist);
          setCurrentSongIndex(0);
          setCurrentFolder("__MIX_ALL__");
          setMixAllMode(true);

          // Apply shuffle if enabled
          if (shuffleMode) {
            const indices = Array.from({ length: megaPlaylist.length }, (_, i) => i);
            setShuffledIndices(shuffleArray(indices));
          }
        }
      });
    } else {
      // Turning Mix All OFF - revert to first folder
      setMixAllMode(false);
      setShuffledIndices([]);
      if (folders.length > 0) {
        setCurrentFolder(folders[0]);
        // The useEffect will reload the playlist
      }
    }
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
    // revoke blob urls
    const pl = myPlaylists.find(p => p.id === plId);
    if (pl) {
      pl.songs.forEach(s => {
        const url = blobStore.current.get(s.id);
        if (url) URL.revokeObjectURL(url);
        blobStore.current.delete(s.id);
        fileStore.current.delete(s.id);
      });
    }
    // if currently playing from this playlist, stop
    if (myLibPlaylistId === plId) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      setIsPlaying(false);
      setMyLibSongId(null);
      setMyLibPlaylistId(null);
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
    if (myLibSongId === songId) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      setIsPlaying(false);
      setMyLibSongId(null);
      setMyLibPlaylistId(null);
    }
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
    // store files and create blob urls
    newSongs.forEach((s, i) => {
      fileStore.current.set(s.id, files[i]);
      blobStore.current.set(s.id, URL.createObjectURL(files[i]));
    });
    const updated = myPlaylists.map(p =>
      p.id === plId ? { ...p, songs: [...p.songs, ...newSongs] } : p
    );
    setMyPlaylists(updated);
    saveMyLib(updated);
    // reset file input so same file can be re-added
    e.target.value = "";
  };

  const playMyLibSong = (plId: string, songId: string) => {
    const url = blobStore.current.get(songId);
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    setMyLibSongId(songId);
    setMyLibPlaylistId(plId);
    setIsPlaying(true);
    setTrackKey(k => k + 1);
    setCoverLoaded(false);
    setShowLibrary(false);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const filteredSongs  = songs.filter(s => cleanSongName(s).toLowerCase().includes(searchQuery.toLowerCase()));

  let currentTrack = "Select a track";
  let currentTrackSubtitle = "";

  if (myLibSongId && myLibPlaylistId) {
    const pl = myPlaylists.find(p => p.id === myLibPlaylistId);
    const song = pl?.songs.find(s => s.id === myLibSongId);
    currentTrack = song?.name ?? "Unknown Track";
    currentTrackSubtitle = pl?.name ?? "My Library";
  } else if (songs.length > 0) {
    currentTrack = cleanSongName(songs[currentSongIndex]);
    currentTrackSubtitle = folderInfo[currentFolder] || "";
  }

  const currentCover   = (myLibSongId) ? "/logo.png" : (mixAllMode || currentFolder === "__MIX_ALL__") ? "/logo.png" : (currentFolder ? `/songs/${currentFolder}/cover.jpeg` : "/logo.png");
  const progressPct    = duration ? (currentTime / duration) * 100 : 0;

  const openedPlaylist = myPlaylists.find(p => p.id === openMyPlaylist);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] text-white selection:bg-purple-500/30">

      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* ── New Playlist Modal ────────────────────────────────────────────── */}
      {showNewPlaylistModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNewPlaylistModal(false)} />
          <div className="relative glass rounded-2xl px-6 py-6 w-80 flex flex-col gap-4 shadow-2xl border-white/10">
            <h3 className="text-lg font-bold">New Playlist</h3>
            <input
              autoFocus
              type="text"
              placeholder="Playlist name…"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlaylist(); if (e.key === "Escape") setShowNewPlaylistModal(false); }}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/60 placeholder:text-white/25 transition-colors"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createPlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold animate-grad disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ambient orbs ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-purple-600/20 blur-[120px] animate-orb" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-[120px] animate-orb" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-pink-600/10 blur-[150px] animate-orb" style={{ animationDelay: "1s" }} />
      </div>

      {/* ── Album art blurred background ─────────────────────────────────── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={currentCover}
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
          alt=""
          className="w-full h-full object-cover opacity-30 blur-3xl animate-sway saturate-200"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-[#050505]/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,transparent,#050505)]" />
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="absolute top-0 w-full px-6 py-5 flex justify-between items-center z-20">
        <div className="animate-fade-in">
          <p className="text-purple-400/80 text-[10px] font-bold tracking-[0.3em] uppercase">Now Playing</p>
          <p className="text-white/70 font-semibold tracking-wide text-sm mt-0.5">
            {mixAllMode ? "Mix Mode" : myLibSongId ? (myPlaylists.find(p => p.id === myLibPlaylistId)?.name ?? "My Library") : (folderInfo[currentFolder] || "Bantora")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMixAll}
            className={`w-10 h-10 flex items-center justify-center rounded-full glass border transition-all hover:scale-110 ${
              mixAllMode
                ? "border-purple-500/40 bg-purple-500/20 text-purple-400"
                : "border-white/10 hover:bg-white/10 text-white/50"
            }`}
            title="Mix All Playlists"
          >
            <Layers className="w-4 h-4" />
          </button>
          <Link
            href="/admin"
            className="w-10 h-10 flex items-center justify-center rounded-full glass border-white/10 hover:bg-white/10 hover:scale-110 transition-all"
            title="Admin"
          >
            <Settings className="w-4 h-4 text-white/50" />
          </Link>
          <button
            onClick={() => setShowLibrary(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full glass border-white/10 hover:bg-white/10 hover:scale-110 transition-all"
          >
            <Library className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* ── Center: Album art + track title ──────────────────────────────── */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none px-6">

        {/* Album art circle with spinning ring */}
        <div key={`cover-${trackKey}`} className="relative mb-8 animate-pop">
          {/* Spinning gradient ring */}
          <div className={`absolute inset-0 rounded-full animate-ring p-[3px] ${isPlaying ? "opacity-100" : "opacity-40"}`}
               style={{ background: "conic-gradient(from 0deg, #6366f1, #a855f7, #ec4899, transparent, #6366f1)" }}>
            <div className="w-full h-full rounded-full bg-[#050505]" />
          </div>

          {/* Cover image */}
          <div className="relative w-52 h-52 md:w-64 md:h-64 rounded-full overflow-hidden ring-1 ring-white/10 shadow-2xl">
            <img
              src={currentCover}
              onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
              onLoad={() => setCoverLoaded(true)}
              alt=""
              className={`w-full h-full object-cover transition-all duration-700 ${coverLoaded ? "scale-100 opacity-100" : "scale-110 opacity-0"} ${isPlaying ? "animate-sway" : ""}`}
              style={isPlaying ? { animationDuration: "20s" } : {}}
            />
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]" />
          </div>
        </div>

        {/* Track name */}
        <div key={`title-${trackKey}`} className="animate-slide-up text-center">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white drop-shadow-2xl line-clamp-2 max-w-xs md:max-w-lg">
            {currentTrack}
          </h1>
          <p className="text-purple-400/70 text-xs tracking-[0.4em] uppercase mt-3 font-medium">
            Bantora &nbsp;·&nbsp; {currentTrackSubtitle}
          </p>
        </div>
      </div>

      {/* ── Controls pill ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
        <div className="glass-pill rounded-[2.5rem] px-5 py-5 flex flex-col gap-4 animate-slide-up">

          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/40 w-8 shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden cursor-pointer group">
              <input
                type="range" min={0} max={duration || 100} value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              {/* Filled track */}
              <div className="absolute top-0 left-0 h-full progress-bar rounded-full transition-all duration-100"
                   style={{ width: `${progressPct}%` }} />
              {/* Thumb dot */}
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                   style={{ left: `calc(${progressPct}% - 6px)` }} />
            </div>
            <span className="text-[10px] font-mono text-white/40 w-8 text-right shrink-0">{formatTime(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={toggleShuffle}
              disabled={songs.length <= 1}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ${
                shuffleMode 
                  ? "text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]" 
                  : "text-white/40 hover:bg-white/10 hover:text-white/60"
              } ${songs.length <= 1 ? "opacity-30 cursor-not-allowed" : ""}`}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={handlePrev}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all hover:scale-110 active:scale-95"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="relative w-16 h-16 rounded-full flex items-center justify-center animate-grad shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:scale-110 active:scale-95 transition-transform"
            >
              {/* Pulsing ring when playing */}
              {isPlaying && (
                <span className="absolute inset-0 rounded-full animate-ping bg-purple-500/30" />
              )}
              {isPlaying
                ? <Pause className="w-7 h-7 fill-white text-white relative z-10" />
                : <Play  className="w-7 h-7 fill-white text-white relative z-10 ml-1" />
              }
            </button>

            <button
              onClick={handleNext}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all hover:scale-110 active:scale-95"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ${
                repeatMode !== "off"
                  ? "text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                  : "text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
              title={`Repeat: ${repeatMode === "off" ? "Off" : repeatMode === "all" ? "All" : "One"}`}
            >
              <Repeat className="w-5 h-5" />
              {repeatMode === "one" && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                  1
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Library overlay ───────────────────────────────────────────────── */}
      <div className={`absolute inset-0 z-50 transition-all duration-500 ease-in-out ${showLibrary ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={() => setShowLibrary(false)} />

        {/* Panel */}
        <div className={`absolute inset-y-0 right-0 w-full md:w-[520px] flex flex-col transition-transform duration-500 ${showLibrary ? "translate-x-0" : "translate-x-full"}`}>
          {/* Gradient side border */}
          <div className="absolute left-0 inset-y-0 w-[2px] sidebar-accent opacity-30" />

          <div className="relative h-full flex flex-col bg-[#0a0a0f]/90 backdrop-blur-3xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-8 pb-4 shrink-0">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Library</h2>
                <p className="text-white/40 text-xs mt-0.5">Choose your vibe</p>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-all hover:scale-110"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="px-6 mb-4 shrink-0">
              <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
                <button
                  onClick={() => setLibraryTab("playlists")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    libraryTab === "playlists"
                      ? "bg-purple-500/20 text-purple-300 shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <ListMusic className="w-4 h-4" />
                  Playlists
                </button>
                <button
                  onClick={() => setLibraryTab("mylib")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    libraryTab === "mylib"
                      ? "bg-purple-500/20 text-purple-300 shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Music2 className="w-4 h-4" />
                  My Library
                </button>
              </div>
            </div>

            {/* ── Tab: Playlists ─────────────────────────────────────────── */}
            {libraryTab === "playlists" && (
              <>
                {/* Playlists scroll row */}
                <div className="px-6 mb-4 shrink-0">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30 mb-3">Playlists</p>
                  <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                    {folders.map(folder => {
                      const active = folder === currentFolder;
                      return (
                        <button
                          key={folder}
                          onClick={() => { setCurrentFolder(folder); setMyLibSongId(null); setMyLibPlaylistId(null); setIsPlaying(true); }}
                          className={`group relative flex-shrink-0 w-28 rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 ${active && !myLibSongId ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-[#0a0a0f]" : ""}`}
                        >
                          <img
                            src={`/songs/${folder}/cover.jpeg`}
                            onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                            className="w-full aspect-square object-cover"
                            alt=""
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <p className="absolute bottom-0 left-0 right-0 px-2 pb-2 text-[11px] font-bold leading-tight line-clamp-2">
                            {folderInfo[folder] || folder}
                          </p>
                          {active && !myLibSongId && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.9)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search */}
                <div className="px-6 mb-3 shrink-0">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
                    <Search className="w-4 h-4 text-white/30 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search tracks…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/25"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Track list */}
                <div className="flex-1 overflow-y-auto px-4 pb-8 hide-scrollbar">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30 px-2 mb-3">
                    {filteredSongs.length} Tracks
                  </p>
                  <div className="space-y-1">
                    {filteredSongs.map((song, idx) => {
                      const origIdx = songs.indexOf(song);
                      const active  = origIdx === currentSongIndex && !myLibSongId;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentSongIndex(origIdx);
                            setMyLibSongId(null);
                            setMyLibPlaylistId(null);
                            setIsPlaying(true);
                            setShowLibrary(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group
                            ${active
                              ? "bg-purple-500/15 border border-purple-500/20"
                              : "hover:bg-white/5 border border-transparent"}`}
                        >
                          {/* Number / waveform */}
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {active && isPlaying ? (
                              <Waveform />
                            ) : (
                              <span className={`text-xs font-mono ${active ? "text-purple-400" : "text-white/25"}`}>
                                {String(origIdx + 1).padStart(2, "0")}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <span className={`flex-1 text-sm font-medium truncate ${active ? "text-white" : "text-white/65 group-hover:text-white/90"}`}>
                            {cleanSongName(song)}
                          </span>

                          {/* Active dot */}
                          {active && (
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                          )}
                        </button>
                      );
                    })}
                    {filteredSongs.length === 0 && (
                      <p className="text-center text-white/25 text-sm py-12">No tracks found.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: My Library ────────────────────────────────────────── */}
            {libraryTab === "mylib" && (
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* ── Playlist detail view ──────────────────────────────── */}
                {openMyPlaylist && openedPlaylist ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Sub-header */}
                    <div className="px-6 pb-4 shrink-0 flex items-center gap-3">
                      <button
                        onClick={() => setOpenMyPlaylist(null)}
                        className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-all"
                        aria-label="Back"
                      >
                        <SkipBack className="w-3.5 h-3.5 text-white/60" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{openedPlaylist.name}</p>
                        <p className="text-[11px] text-white/40">{openedPlaylist.songs.length} songs</p>
                      </div>
                      <button
                        onClick={() => openAddSongs(openedPlaylist.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Songs
                      </button>
                    </div>

                    {/* Refresh note */}
                    <div className="mx-6 mb-3 px-3 py-2 rounded-xl bg-white/4 border border-white/6 shrink-0">
                      <p className="text-[10px] text-white/35 leading-relaxed">
                        Song files live in memory only — re-add them after a page refresh.
                      </p>
                    </div>

                    {/* Song list */}
                    <div className="flex-1 overflow-y-auto px-4 pb-8 hide-scrollbar">
                      {openedPlaylist.songs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <FolderOpen className="w-10 h-10 text-white/15" />
                          <p className="text-white/25 text-sm">No songs yet</p>
                          <button
                            onClick={() => openAddSongs(openedPlaylist.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all"
                          >
                            <Plus className="w-4 h-4" /> Add Songs
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {openedPlaylist.songs.map((song, idx) => {
                            const active = song.id === myLibSongId;
                            const hasBlob = blobStore.current.has(song.id);
                            return (
                              <div
                                key={song.id}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group
                                  ${active
                                    ? "bg-purple-500/15 border border-purple-500/20"
                                    : "hover:bg-white/5 border border-transparent"}`}
                              >
                                {/* Number / waveform */}
                                <button
                                  onClick={() => hasBlob ? playMyLibSong(openedPlaylist.id, song.id) : undefined}
                                  className="w-7 h-7 flex items-center justify-center shrink-0"
                                  disabled={!hasBlob}
                                  aria-label="Play"
                                >
                                  {active && isPlaying ? (
                                    <Waveform />
                                  ) : (
                                    <span className={`text-xs font-mono ${active ? "text-purple-400" : "text-white/25"}`}>
                                      {String(idx + 1).padStart(2, "0")}
                                    </span>
                                  )}
                                </button>

                                {/* Title + re-add note */}
                                <button
                                  onClick={() => hasBlob ? playMyLibSong(openedPlaylist.id, song.id) : undefined}
                                  disabled={!hasBlob}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <span className={`text-sm font-medium truncate block ${active ? "text-white" : hasBlob ? "text-white/65 group-hover:text-white/90" : "text-white/30"}`}>
                                    {song.name}
                                  </span>
                                  {!hasBlob && (
                                    <span className="text-[10px] text-orange-400/60">Re-add after refresh</span>
                                  )}
                                </button>

                                {/* Active dot */}
                                {active && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                                )}

                                {/* Delete song */}
                                <button
                                  onClick={() => deleteSong(openedPlaylist.id, song.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                                  aria-label="Remove song"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                ) : (
                  /* ── Playlist list view ────────────────────────────────── */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* New playlist button */}
                    <div className="px-6 mb-4 shrink-0">
                      <button
                        onClick={() => setShowNewPlaylistModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-500/15 border border-purple-500/20 text-purple-300 text-sm font-semibold hover:bg-purple-500/25 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        New Playlist
                      </button>
                    </div>

                    {/* Playlist cards */}
                    <div className="flex-1 overflow-y-auto px-4 pb-8 hide-scrollbar">
                      {myPlaylists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                          <Music2 className="w-12 h-12 text-white/10" />
                          <p className="text-white/25 text-sm text-center leading-relaxed">
                            No playlists yet.<br />Create one to add your own songs.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {myPlaylists.map(pl => {
                            const isActive = pl.id === myLibPlaylistId;
                            return (
                              <div
                                key={pl.id}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all
                                  ${isActive
                                    ? "bg-purple-500/15 border-purple-500/20"
                                    : "bg-white/3 border-white/6 hover:bg-white/6"}`}
                              >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-purple-500/30" : "bg-white/8"}`}>
                                  <ListMusic className={`w-5 h-5 ${isActive ? "text-purple-300" : "text-white/40"}`} />
                                </div>

                                {/* Info */}
                                <button
                                  onClick={() => setOpenMyPlaylist(pl.id)}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <p className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-white/80"}`}>
                                    {pl.name}
                                  </p>
                                  <p className="text-[11px] text-white/35 mt-0.5">
                                    {pl.songs.length} {pl.songs.length === 1 ? "song" : "songs"}
                                  </p>
                                </button>

                                {/* Active indicator */}
                                {isActive && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                                )}

                                {/* Delete playlist */}
                                <button
                                  onClick={() => deletePlaylist(pl.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                                  aria-label="Delete playlist"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
