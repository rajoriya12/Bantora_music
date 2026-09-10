"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Library, X, Search 
} from "lucide-react";

type Song = string;
type Folder = string;

// Helper: Clean song names safely
function cleanSongName(track: string) {
  let name = track.split("/").pop() || track;
  name = decodeURIComponent(name);
  name = name.replace(/\.mp3$/i, "");
  name = name.replace(/\(pagalworldi\.com\.co\)/gi, "")
             .replace(/\(koshalworld\.com\)/gi, "")
             .replace(/\(mp3\.pm\)/gi, "")
             .replace(/HindiRapsong2021/gi, "");
  name = name.replace(/[-_]/g, " ").trim();
  return name || "Unknown Track";
}

// Helper: Format Time
function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function MusicPlayer() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderInfo, setFolderInfo] = useState<Record<string, string>>({});
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [showLibrary, setShowLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Element
  useEffect(() => {
    audioRef.current = new Audio();

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      handleNext();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial folders
  useEffect(() => {
    async function fetchFolders() {
      try {
        const res = await fetch('/api/admin/folders');
        if (res.ok) {
          const data = await res.json();
          setFolders(data.folders);
          // Set default folder if none selected and currentFolder is empty
          if (!currentFolder && data.folders.length > 0) {
            setCurrentFolder(data.folders[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load folders', e);
      }
    }
    fetchFolders();
  }, []);

  // Fetch Folder Metadata after folders are loaded
  useEffect(() => {
    if (folders.length === 0) return;
    async function fetchMetadata() {
      const info: Record<string, string> = {};
      for (const folder of folders) {
        try {
          const res = await fetch(`/songs/${folder}/info.json`);
          if (res.ok) {
            const data = await res.json();
            info[folder] = data.title || data.tital || folder;
          } else {
            info[folder] = folder;
          }
        } catch (e) {
          info[folder] = folder;
        }
      }
      setFolderInfo(info);
    }
    fetchMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  // Load Playlist when folder changes
  useEffect(() => {
    if (!currentFolder) return;
    async function loadPlaylist() {
      try {
        const res = await fetch(`/songs/${currentFolder}/playlist.json`);
        if (res.ok) {
          const data: string[] = await res.json();
          setSongs(data);
          setCurrentSongIndex(0); // Reset index on new playlist
        } else {
          setSongs([]);
        }
      } catch (e) {
        console.error("Failed to load playlist", e);
        setSongs([]);
      }
    }
    loadPlaylist();
  }, [currentFolder]);

  // Update Audio Source when Song changes
  useEffect(() => {
    if (songs.length > 0 && audioRef.current && currentFolder) {
      let trackPath = songs[currentSongIndex];
      if (trackPath.startsWith("/")) trackPath = trackPath.substring(1);
      
      const newSrc = `/songs/${currentFolder}/${trackPath}`;
      if (!audioRef.current.src.endsWith(newSrc.replace(/ /g, "%20"))) {
        audioRef.current.src = newSrc;
        setCurrentTime(0);
        if (isPlaying) {
          audioRef.current.play().catch(e => console.error("Playback prevented:", e));
        }
      }
    }
  }, [currentSongIndex, songs, currentFolder, isPlaying]);

  // Controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Playback prevented:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (currentSongIndex < songs.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(prev => prev - 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration) {
      const newTime = parseFloat(e.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const filteredSongs = songs.filter(song => 
    cleanSongName(song).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentTrackName = songs.length > 0 ? cleanSongName(songs[currentSongIndex]) : "Select a track";
  const currentCover = currentFolder ? `/songs/${currentFolder}/cover.jpeg` : "/logo.png";

  // Calculate progress for circular ring
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white selection:bg-white/30">
      
      {/* 1. The Immersive Background Hologram */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img 
          src={currentCover} 
          onError={(e) => { e.currentTarget.src = "/logo.png" }}
          alt="" 
          className="w-full h-full object-cover opacity-60 blur-3xl animate-sway saturate-150 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent mix-blend-multiply" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/60 to-black" />
      </div>

      {/* Top Navigation */}
      <div className="absolute top-0 w-full p-8 flex justify-between items-start z-20">
        <div className="flex flex-col gap-1">
          <p className="text-white/50 text-xs font-bold tracking-[0.2em] uppercase">Now Playing</p>
          <p className="text-white/80 font-medium tracking-wide">
            {folderInfo[currentFolder] || "Bantora Mix"}
          </p>
        </div>
        
        <button 
          onClick={() => setShowLibrary(true)}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:scale-105 transition-all"
        >
          <Library className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 2. Giant Holographic Typography (Centerpiece) */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter animate-float drop-shadow-2xl mix-blend-overlay opacity-90 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
          {currentTrackName}
        </h1>
        <p className="text-lg md:text-xl text-white/50 tracking-[0.3em] uppercase mt-8 font-light drop-shadow-lg">
          Bantora
        </p>
      </div>

      {/* 3. Floating Glass Pill (Controls) */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-sm px-4">
        <div className="glass-pill rounded-[2rem] p-4 flex flex-col gap-4">
          
          {/* Progress Bar Line */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-[10px] font-mono text-white/50">{formatTime(currentTime)}</span>
            <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <input 
                type="range" 
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100 ease-out" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white/50">{formatTime(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-8">
            <button onClick={handlePrev} className="text-white/60 hover:text-white transition-colors">
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
            
            <button 
              onClick={togglePlay}
              className="w-14 h-14 relative flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            
            <button onClick={handleNext} className="text-white/60 hover:text-white transition-colors">
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. The Hidden Dimension Library (Overlay) */}
      <div className={`absolute inset-0 z-50 transition-all duration-700 ease-in-out ${showLibrary ? "opacity-100 backdrop-blur-3xl bg-black/60" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute top-8 right-8">
          <button 
            onClick={() => setShowLibrary(false)}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="w-full h-full flex flex-col md:flex-row p-6 pt-20 md:p-8 md:pt-24 gap-6 md:gap-12 max-w-7xl mx-auto">
          
          {/* Folders/Playlists (Left) */}
          <div className="md:w-1/3 flex flex-col gap-4 md:gap-6 shrink-0">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Your Dimensions</h2>
            <div className="flex overflow-x-auto md:flex-col gap-4 pb-4 md:pb-0 snap-x hide-scrollbar">
              {folders.map(folder => {
                const isActive = folder === currentFolder;
                return (
                  <div 
                    key={folder}
                    onClick={() => {
                      setCurrentFolder(folder);
                      setIsPlaying(true);
                    }}
                    className={`group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl cursor-pointer transition-all snap-start shrink-0 w-[200px] md:w-auto ${isActive ? 'bg-white text-black' : 'hover:bg-white/10'}`}
                  >
                    <img 
                      src={`/songs/${folder}/cover.jpeg`} 
                      onError={(e) => { e.currentTarget.src = "/logo.png" }}
                      className="w-16 h-16 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform" 
                      alt="" 
                    />
                    <div>
                      <h3 className={`font-bold text-base md:text-lg ${isActive ? 'text-black' : 'text-white'}`}>
                        {folderInfo[folder] || folder}
                      </h3>
                      <p className={`text-xs md:text-sm ${isActive ? 'text-black/60' : 'text-white/40'}`}>Playlist</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Playlist Tracks (Right) */}
          <div className="md:w-2/3 flex flex-col h-full overflow-hidden flex-1">
            <div className="flex items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-full border border-white/10 mb-4 md:mb-8 backdrop-blur-md shrink-0">
              <Search className="w-5 h-5 text-white/50 ml-2" />
              <input 
                type="text" 
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-white w-full placeholder:text-white/30 font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 md:pr-4 pb-32 md:pb-24 hide-scrollbar">
              {filteredSongs.map((song, idx) => {
                const originalIndex = songs.indexOf(song);
                const isActive = originalIndex === currentSongIndex;
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      setCurrentSongIndex(originalIndex);
                      setIsPlaying(true);
                      setShowLibrary(false); // Auto close library when track selected
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-white/20 backdrop-blur-md border border-white/10' : 'hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-4 truncate">
                      <span className={`text-sm font-mono ${isActive ? 'text-white' : 'text-white/30'}`}>
                        {String(originalIndex + 1).padStart(2, '0')}
                      </span>
                      <span className={`truncate text-lg font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {cleanSongName(song)}
                      </span>
                    </div>
                    {isActive && isPlaying && (
                      <div className="flex gap-1 h-4 items-center">
                        <div className="w-1 h-full bg-white animate-pulse rounded-full"></div>
                        <div className="w-1 h-3 bg-white animate-pulse rounded-full" style={{ animationDelay: '100ms' }}></div>
                        <div className="w-1 h-full bg-white animate-pulse rounded-full" style={{ animationDelay: '200ms' }}></div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredSongs.length === 0 && (
                <div className="text-center text-white/30 mt-12 font-medium">
                  No tracks found in this dimension.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
