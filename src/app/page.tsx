"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Library, X, Search, Settings } from "lucide-react";
import Link from "next/link";

type Song = string;
type Folder = string;

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

// Animated waveform bars (shown when playing)
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

export default function MusicPlayer() {
  const [folders, setFolders]       = useState<Folder[]>([]);
  const [folderInfo, setFolderInfo] = useState<Record<string, string>>({});
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [songs, setSongs]           = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [trackKey, setTrackKey]     = useState(0); // triggers pop animation on track change

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Audio engine ──────────────────────────────────────────────────────────
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

  // ── Data fetching ─────────────────────────────────────────────────────────
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
    if (!currentFolder) return;
    fetch(`/songs/${currentFolder}/playlist.json`)
      .then(r => r.ok ? r.json() : [])
      .then((d: string[]) => { setSongs(d); setCurrentSongIndex(0); })
      .catch(() => setSongs([]));
  }, [currentFolder]);

  // ── Audio source update ───────────────────────────────────────────────────
  useEffect(() => {
    if (!songs.length || !audioRef.current || !currentFolder) return;
    let p = songs[currentSongIndex];
    if (p.startsWith("/")) p = p.substring(1);
    const src = `/songs/${currentFolder}/${p}`;
    if (!audioRef.current.src.endsWith(src.replace(/ /g, "%20"))) {
      audioRef.current.src = src;
      setCurrentTime(0);
      setCoverLoaded(false);
      setTrackKey(k => k + 1);
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongIndex, songs, currentFolder]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play().catch(() => {}); }
    setIsPlaying(p => !p);
  };

  const handleNext = () => {
    if (currentSongIndex < songs.length - 1) setCurrentSongIndex(i => i + 1);
    else setIsPlaying(false);
  };
  const handlePrev = () => {
    if (currentSongIndex > 0) setCurrentSongIndex(i => i - 1);
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const filteredSongs  = songs.filter(s => cleanSongName(s).toLowerCase().includes(searchQuery.toLowerCase()));
  const currentTrack   = songs.length > 0 ? cleanSongName(songs[currentSongIndex]) : "Select a track";
  const currentCover   = currentFolder ? `/songs/${currentFolder}/cover.jpeg` : "/logo.png";
  const progressPct    = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] text-white selection:bg-purple-500/30">

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
            {folderInfo[currentFolder] || "Bantora"}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            Bantora &nbsp;·&nbsp; {folderInfo[currentFolder] || ""}
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

            {/* Playlists scroll row */}
            <div className="px-6 mb-4 shrink-0">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30 mb-3">Playlists</p>
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {folders.map(folder => {
                  const active = folder === currentFolder;
                  return (
                    <button
                      key={folder}
                      onClick={() => { setCurrentFolder(folder); setIsPlaying(true); }}
                      className={`group relative flex-shrink-0 w-28 rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 ${active ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-[#0a0a0f]" : ""}`}
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
                      {active && (
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
                  const active  = origIdx === currentSongIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentSongIndex(origIdx);
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
          </div>
        </div>
      </div>
    </div>
  );
}
