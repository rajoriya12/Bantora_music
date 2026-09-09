"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Search, 
  Library, Home, Disc, ListMusic 
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
  const folders: Folder[] = ["lofisongs", "playlist", "seedhemuat"];
  const [folderInfo, setFolderInfo] = useState<Record<string, string>>({});
  const [currentFolder, setCurrentFolder] = useState<string>("playlist");
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

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

  // Fetch Folder Metadata
  useEffect(() => {
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
  }, []);

  // Load Playlist when folder changes
  useEffect(() => {
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
    if (songs.length > 0 && audioRef.current) {
      let trackPath = songs[currentSongIndex];
      if (trackPath.startsWith("/")) trackPath = trackPath.substring(1);
      
      const newSrc = `/songs/${currentFolder}/${trackPath}`;
      // Prevent reloading if same source
      if (!audioRef.current.src.endsWith(newSrc.replace(/ /g, "%20"))) {
        audioRef.current.src = newSrc;
        setCurrentTime(0);
        if (isPlaying) {
          audioRef.current.play().catch(e => console.error("Playback prevented:", e));
        }
      }
    }
  }, [currentSongIndex, songs, currentFolder, isPlaying]);

  // Volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
  const currentCover = `/songs/${currentFolder}/cover.jpeg`;

  return (
    <div className="flex h-screen bg-[#121212] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black flex flex-col p-6 hidden md:flex border-r border-zinc-900">
        <div className="flex items-center gap-3 mb-10">
          <Disc className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold tracking-tight">Bantora</h1>
        </div>

        <nav className="space-y-4 mb-8 text-zinc-400 font-medium">
          <div className="flex items-center gap-4 hover:text-white cursor-pointer transition-colors">
            <Home className="w-5 h-5" /> Home
          </div>
          <div className="flex items-center gap-4 hover:text-white cursor-pointer transition-colors">
            <Search className="w-5 h-5" /> Search
          </div>
          <div className="flex items-center gap-4 text-white cursor-pointer transition-colors">
            <Library className="w-5 h-5" /> Your Library
          </div>
        </nav>

        <div className="mt-8 flex-1 overflow-y-auto">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4">Playlists</p>
          <div className="space-y-3">
            {folders.map(folder => (
              <div 
                key={folder}
                onClick={() => {
                  setCurrentFolder(folder);
                  setIsPlaying(true); // Auto play on switch
                }}
                className={`text-sm cursor-pointer truncate transition-colors ${
                  currentFolder === folder ? "text-green-500 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                {folderInfo[folder] || folder}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-zinc-800 to-[#121212] overflow-hidden">
        
        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between sticky top-0 bg-transparent z-10">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search in playlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-transparent focus:border-zinc-700 text-sm text-white rounded-full pl-10 pr-4 py-2 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
              <span className="text-sm font-bold">R</span>
            </div>
          </div>
        </header>

        {/* Playlist Banner */}
        <div className="px-8 py-6 flex items-end gap-6 pb-8 border-b border-white/5">
          <img 
            src={currentCover} 
            alt="Cover" 
            onError={(e) => { e.currentTarget.src = "/logo.png" }}
            className="w-48 h-48 shadow-2xl rounded-sm object-cover"
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-widest text-white/70">Playlist</span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">
              {folderInfo[currentFolder] || currentFolder}
            </h1>
            <p className="text-zinc-400 text-sm font-medium mt-2">Bantora • {songs.length} songs</p>
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto px-8 pb-32 pt-6">
          <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-4 px-4 py-2 text-sm text-zinc-400 border-b border-white/5 mb-4">
            <span className="text-right">#</span>
            <span>Title</span>
          </div>
          
          <div className="space-y-1">
            {filteredSongs.map((song, idx) => {
              // Find actual index in original songs array to play correctly
              const originalIndex = songs.indexOf(song);
              const isActive = originalIndex === currentSongIndex;
              
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setCurrentSongIndex(originalIndex);
                    setIsPlaying(true);
                  }}
                  className={`group grid grid-cols-[16px_minmax(0,1fr)] items-center gap-4 px-4 py-3 rounded-md hover:bg-white/10 cursor-pointer transition-colors ${
                    isActive ? "bg-white/10" : ""
                  }`}
                >
                  <span className={`text-right text-sm ${isActive ? "text-green-500" : "text-zinc-400 group-hover:text-white"}`}>
                    {isActive && isPlaying ? <ListMusic className="w-4 h-4 animate-pulse text-green-500" /> : originalIndex + 1}
                  </span>
                  <div className="flex items-center gap-4 truncate">
                    <img src={currentCover} onError={(e) => { e.currentTarget.src = "/logo.png" }} className="w-10 h-10 object-cover rounded-sm shadow-sm" alt="track" />
                    <div className="flex flex-col truncate">
                      <span className={`truncate font-medium ${isActive ? "text-green-500" : "text-white"}`}>{cleanSongName(song)}</span>
                      <span className="text-xs text-zinc-400">Bantora</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Bottom Player Bar */}
      <footer className="h-24 bg-[#181818] border-t border-zinc-800 absolute bottom-0 w-full flex items-center justify-between px-4 z-50">
        
        {/* Now Playing Info */}
        <div className="w-1/3 flex items-center gap-4">
          <img 
            src={currentCover} 
            onError={(e) => { e.currentTarget.src = "/logo.png" }}
            className={`w-14 h-14 rounded-sm object-cover shadow-lg transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`} 
            alt="Cover" 
          />
          <div className="flex flex-col truncate">
            <span className="text-white text-sm font-semibold truncate hover:underline cursor-pointer">{currentTrackName}</span>
            <span className="text-xs text-zinc-400 hover:underline cursor-pointer">Bantora</span>
          </div>
        </div>

        {/* Player Controls */}
        <div className="w-1/3 flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <button onClick={handlePrev} className="text-zinc-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          
          <div className="w-full max-w-md flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-500 transition-all"
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="w-1/3 flex justify-end items-center gap-3 pr-4">
          <Volume2 className="w-5 h-5 text-zinc-400" />
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.01} 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full transition-all"
          />
        </div>
      </footer>
    </div>
  );
}
