"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderOpen,
  Music2,
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Pencil,
  Check,
  X,
  GripVertical,
  ImagePlus,
  ChevronRight,
  HardDrive,
  ListMusic,
  Layers,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FolderStat {
  name: string;
  title: string;
  songCount: number;
  sizeMB: number;
}

interface Stats {
  folders: number;
  songs: number;
  totalSizeMB: number;
  folderStats: FolderStat[];
}

interface FolderInfo {
  title: string;
  description: string;
}

type Tab = "dashboard" | "playlists" | "songs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return name || track;
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-medium transition-all animate-slide-up ${
        type === "success"
          ? "bg-emerald-950 border-emerald-500/40 text-emerald-300"
          : "bg-red-950 border-red-500/40 text-red-300"
      }`}
    >
      {type === "success" ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        <p className="text-white/50 text-sm mt-1">{label}</p>
        {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Dashboard
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Playlists tab
  const [folders, setFolders] = useState<string[]>([]);
  const [folderInfoMap, setFolderInfoMap] = useState<Record<string, FolderInfo>>({});
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  // Edit playlist modal
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Songs tab
  const [songs, setSongs] = useState<string[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragItemIdx = useRef<number | null>(null);
  const songUploadRef = useRef<HTMLInputElement>(null);
  const multiUploadRef = useRef<HTMLInputElement>(null);

  // ── toast helpers ──────────────────────────────────────────────────────────

  const notify = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
    },
    []
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // non-fatal
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Folders ────────────────────────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/folders");
      if (!res.ok) return;
      const data = await res.json();
      const list: string[] = data.folders || [];
      setFolders(list);
      if (!selectedFolder && list.length > 0) setSelectedFolder(list[0]);

      // Fetch info.json for each folder
      const infoMap: Record<string, FolderInfo> = {};
      await Promise.all(
        list.map(async (folder) => {
          try {
            const r = await fetch(
              `/songs/${folder}/info.json?t=${Date.now()}`
            );
            if (r.ok) {
              const d = await r.json();
              infoMap[folder] = {
                title: d.title || d.tital || folder,
                description: d.description || d.des || "",
              };
            } else {
              infoMap[folder] = { title: folder, description: "" };
            }
          } catch {
            infoMap[folder] = { title: folder, description: "" };
          }
        })
      );
      setFolderInfoMap(infoMap);
    } catch {
      // non-fatal
    }
  }, [selectedFolder]);

  // ── Songs ──────────────────────────────────────────────────────────────────

  const fetchSongs = useCallback(async (folder: string) => {
    if (!folder) return;
    setLoadingSongs(true);
    try {
      const res = await fetch(
        `/songs/${folder}/playlist.json?t=${Date.now()}`
      );
      if (res.ok) setSongs(await res.json());
      else setSongs([]);
    } catch {
      setSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) fetchSongs(selectedFolder);
  }, [selectedFolder]);

  // ── Folder: Create ─────────────────────────────────────────────────────────

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/admin/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName: newFolderName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName("");
        await fetchFolders();
        setSelectedFolder(data.folder);
        fetchStats();
        notify(`Playlist "${data.folder}" created`);
      } else {
        notify(data.error || "Failed to create playlist", "error");
      }
    } catch {
      notify("Network error", "error");
    } finally {
      setCreatingFolder(false);
    }
  };

  // ── Folder: Delete ─────────────────────────────────────────────────────────

  const handleDeleteFolder = async (folder: string) => {
    if (
      !confirm(
        `Delete playlist "${folderInfoMap[folder]?.title || folder}" and ALL its songs? This cannot be undone.`
      )
    )
      return;
    setDeletingFolder(folder);
    try {
      const res = await fetch("/api/admin/folders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedFolder === folder) {
          const remaining = folders.filter((f) => f !== folder);
          setSelectedFolder(remaining[0] || "");
        }
        await fetchFolders();
        fetchStats();
        notify(`Playlist deleted`);
      } else {
        notify(data.error || "Failed to delete", "error");
      }
    } catch {
      notify("Network error", "error");
    } finally {
      setDeletingFolder(null);
    }
  };

  // ── Folder: Edit (open modal) ──────────────────────────────────────────────

  const openEditModal = (folder: string) => {
    setEditingFolder(folder);
    setEditTitle(folderInfoMap[folder]?.title || folder);
    setEditDesc(folderInfoMap[folder]?.description || "");
    setEditCoverFile(null);
    setEditCoverPreview(`/songs/${folder}/cover.jpeg?t=${Date.now()}`);
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const handleSaveEdit = async () => {
    if (!editingFolder) return;
    setSavingEdit(true);
    try {
      const fd = new FormData();
      fd.append("folder", editingFolder);
      fd.append("title", editTitle);
      fd.append("description", editDesc);
      if (editCoverFile) fd.append("cover", editCoverFile);

      const res = await fetch("/api/admin/folders/update", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        await fetchFolders();
        setEditingFolder(null);
        notify("Playlist updated");
      } else {
        notify(data.error || "Failed to save", "error");
      }
    } catch {
      notify("Network error", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Song: Upload (single or multiple) ─────────────────────────────────────

  const uploadFiles = async (files: FileList) => {
    if (!selectedFolder || files.length === 0) return;
    setIsUploading(true);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadingIdx(i);
      const file = files[i];
      const fd = new FormData();
      fd.append("folder", selectedFolder);
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/songs", { method: "POST", body: fd });
        const data = await res.json();
        if (data.success) successCount++;
      } catch {
        // continue uploading rest
      }
    }
    setUploadingIdx(null);
    setIsUploading(false);
    if (songUploadRef.current) songUploadRef.current.value = "";
    if (multiUploadRef.current) multiUploadRef.current.value = "";
    await fetchSongs(selectedFolder);
    fetchStats();
    notify(
      successCount === files.length
        ? `${successCount} song${successCount > 1 ? "s" : ""} uploaded`
        : `${successCount}/${files.length} uploaded (some failed)`,
      successCount > 0 ? "success" : "error"
    );
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  // Drag & drop onto the songs area
  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    const mp3s = Array.from(files).filter((f) =>
      f.type.includes("audio")
    );
    if (mp3s.length === 0) return;
    const dt = new DataTransfer();
    mp3s.forEach((f) => dt.items.add(f));
    uploadFiles(dt.files);
  };

  // ── Song: Delete ───────────────────────────────────────────────────────────

  const handleDeleteSong = async (filename: string) => {
    if (!confirm(`Delete "${cleanSongName(filename)}"?`)) return;
    try {
      const res = await fetch("/api/admin/songs/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, filename }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSongs(selectedFolder);
        fetchStats();
        notify("Song deleted");
      } else {
        notify(data.error || "Failed to delete", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  // ── Song: Rename ───────────────────────────────────────────────────────────

  const startRename = (idx: number) => {
    const raw = songs[idx];
    const base = raw.startsWith("/") ? raw.substring(1) : raw;
    setRenamingIdx(idx);
    setRenameValue(base.replace(/\.mp3$/i, ""));
  };

  const commitRename = async (idx: number) => {
    if (!renameValue.trim()) {
      setRenamingIdx(null);
      return;
    }
    const raw = songs[idx];
    const oldFilename = raw.startsWith("/") ? raw.substring(1) : raw;
    const newFilename = renameValue.trim().replace(/\.mp3$/i, "") + ".mp3";
    if (newFilename === oldFilename) {
      setRenamingIdx(null);
      return;
    }
    setSavingRename(true);
    try {
      const res = await fetch("/api/admin/songs/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, oldFilename, newFilename }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSongs(selectedFolder);
        notify("Song renamed");
      } else {
        notify(data.error || "Failed to rename", "error");
      }
    } catch {
      notify("Network error", "error");
    } finally {
      setSavingRename(false);
      setRenamingIdx(null);
    }
  };

  // ── Song: Drag to reorder ──────────────────────────────────────────────────

  const handleDragStart = (idx: number) => {
    dragItemIdx.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    setDragOverIdx(idx);
  };

  const handleDragEnd = async () => {
    if (
      dragItemIdx.current === null ||
      dragOverIdx === null ||
      dragItemIdx.current === dragOverIdx
    ) {
      dragItemIdx.current = null;
      setDragOverIdx(null);
      return;
    }
    const reordered = [...songs];
    const [moved] = reordered.splice(dragItemIdx.current, 1);
    reordered.splice(dragOverIdx, 0, moved);
    setSongs(reordered);
    dragItemIdx.current = null;
    setDragOverIdx(null);
    try {
      await fetch("/api/admin/songs/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, songs: reordered }),
      });
      notify("Order saved");
    } catch {
      notify("Failed to save order", "error");
      fetchSongs(selectedFolder);
    }
  };

  // ── Sidebar nav items ──────────────────────────────────────────────────────

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "playlists", label: "Playlists", icon: FolderOpen },
    { id: "songs", label: "Songs", icon: Music2 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row selection:bg-white/20">
      {/* ── Global CSS injected via style tag ─────────────────────────────── */}
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        .drag-over { outline: 2px dashed rgba(255,255,255,0.3); outline-offset: -2px; background: rgba(255,255,255,0.05); }
      `}</style>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-full md:w-64 shrink-0 bg-black/60 border-b md:border-b-0 md:border-r border-white/10 flex md:flex-col px-4 py-4 md:py-8 gap-2 md:gap-1 overflow-x-auto md:overflow-visible">
        {/* Logo */}
        <div className="hidden md:flex items-center gap-3 px-3 mb-8">
          <img src="/logo.png" alt="Bantora" className="w-8 h-8 rounded-lg" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="font-black text-lg tracking-tight">Bantora</p>
            <p className="text-white/40 text-xs">Admin Panel</p>
          </div>
        </div>

        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
              activeTab === id
                ? "bg-white text-black"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}

        {/* Back to player — at bottom on desktop */}
        <div className="hidden md:block mt-auto">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to Player
          </Link>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-screen overflow-y-auto p-6 md:p-10">

        {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto space-y-10">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
              <p className="text-white/40 mt-1 text-sm">Overview of your Bantora music library</p>
            </div>

            {loadingStats ? (
              <div className="flex items-center gap-3 text-white/40">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading stats…
              </div>
            ) : stats ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Playlists"
                    value={stats.folders}
                    icon={Layers}
                    accent="bg-violet-500/20 text-violet-300"
                  />
                  <StatCard
                    label="Total Songs"
                    value={stats.songs}
                    icon={ListMusic}
                    accent="bg-blue-500/20 text-blue-300"
                  />
                  <StatCard
                    label="Storage Used"
                    value={`${stats.totalSizeMB} MB`}
                    icon={HardDrive}
                    accent="bg-amber-500/20 text-amber-300"
                  />
                  <StatCard
                    label="Avg. per Playlist"
                    value={
                      stats.folders > 0
                        ? Math.round(stats.songs / stats.folders)
                        : 0
                    }
                    sub="songs"
                    icon={Music2}
                    accent="bg-emerald-500/20 text-emerald-300"
                  />
                </div>

                {/* Per-playlist breakdown */}
                <div>
                  <h2 className="text-lg font-bold mb-4">Playlists Breakdown</h2>
                  <div className="space-y-3">
                    {stats.folderStats.map((fs) => (
                      <div
                        key={fs.name}
                        className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors"
                      >
                        <img
                          src={`/songs/${fs.name}/cover.jpeg`}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/logo.png";
                          }}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{fs.title}</p>
                          <p className="text-white/40 text-xs font-mono">{fs.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{fs.songCount}</p>
                          <p className="text-white/40 text-xs">songs</p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="font-bold">{fs.sizeMB} MB</p>
                          <p className="text-white/40 text-xs">size</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFolder(fs.name);
                            setActiveTab("songs");
                          }}
                          className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                          title="Manage songs"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {stats.folderStats.length === 0 && (
                      <p className="text-white/30 text-sm">
                        No playlists yet. Create one in the Playlists tab.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-white/30">Could not load stats.</p>
            )}
          </div>
        )}

        {/* ── PLAYLISTS TAB ─────────────────────────────────────────────── */}
        {activeTab === "playlists" && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight">Playlists</h1>
                <p className="text-white/40 mt-1 text-sm">Create, edit, and delete your playlists</p>
              </div>
            </div>

            {/* Create new playlist */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest text-white/50">
                <Plus className="w-4 h-4" /> New Playlist
              </h2>
              <form onSubmit={handleCreateFolder} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Playlist name (e.g. chill-vibes)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 text-sm placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {creatingFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create
                </button>
              </form>
              <p className="text-white/30 text-xs mt-2">
                Letters, numbers, hyphens and underscores only. Spaces are removed automatically.
              </p>
            </div>

            {/* Existing playlists grid */}
            <div>
              <h2 className="font-bold mb-4 text-sm uppercase tracking-widest text-white/50">
                {folders.length} Playlist{folders.length !== 1 ? "s" : ""}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {folders.map((folder) => (
                  <div
                    key={folder}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group"
                  >
                    {/* Cover */}
                    <div className="relative aspect-square bg-white/5">
                      <img
                        src={`/songs/${folder}/cover.jpeg?t=${Date.now()}`}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/logo.png";
                        }}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={() => openEditModal(folder)}
                          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFolder(folder);
                            setActiveTab("songs");
                          }}
                          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                          title="Manage songs"
                        >
                          <Music2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder)}
                          disabled={deletingFolder === folder}
                          className="w-10 h-10 rounded-full bg-red-500/30 hover:bg-red-500/50 flex items-center justify-center transition-all"
                          title="Delete playlist"
                        >
                          {deletingFolder === folder ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-300" />
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <p className="font-bold truncate">
                        {folderInfoMap[folder]?.title || folder}
                      </p>
                      <p className="text-white/40 text-xs font-mono mt-0.5">{folder}</p>
                      {folderInfoMap[folder]?.description && (
                        <p className="text-white/50 text-xs mt-1 line-clamp-2">
                          {folderInfoMap[folder].description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {folders.length === 0 && (
                  <div className="col-span-full text-center text-white/30 py-16 border border-white/10 border-dashed rounded-2xl">
                    No playlists yet. Create one above.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SONGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "songs" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Songs</h1>
              <p className="text-white/40 mt-1 text-sm">
                Upload, rename, reorder, and delete songs within a playlist
              </p>
            </div>

            {/* Playlist selector */}
            <div className="flex flex-wrap gap-2">
              {folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedFolder === folder
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {folderInfoMap[folder]?.title || folder}
                </button>
              ))}
            </div>

            {selectedFolder ? (
              <>
                {/* Upload zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropZone}
                  className="border-2 border-dashed border-white/15 hover:border-white/30 rounded-2xl p-8 text-center transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto text-white/30 mb-3" />
                  <p className="text-white/50 text-sm mb-3">
                    Drag & drop MP3 files here, or click to browse
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      onChange={handleUploadChange}
                      ref={songUploadRef}
                      className="hidden"
                      id="single-upload"
                    />
                    <label
                      htmlFor="single-upload"
                      className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isUploading ? `Uploading…` : "Upload MP3"}
                    </label>
                    <input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      multiple
                      onChange={handleUploadChange}
                      ref={multiUploadRef}
                      className="hidden"
                      id="multi-upload"
                    />
                    <label
                      htmlFor="multi-upload"
                      className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer hover:bg-white/20 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Upload Multiple
                    </label>
                  </div>
                </div>

                {/* Song list */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="font-bold">
                      {folderInfoMap[selectedFolder]?.title || selectedFolder}
                    </h2>
                    <span className="text-white/40 text-sm">
                      {songs.length} song{songs.length !== 1 ? "s" : ""}
                      {songs.length > 0 && (
                        <span className="ml-2 text-white/20 text-xs">
                          — drag to reorder
                        </span>
                      )}
                    </span>
                  </div>

                  {loadingSongs ? (
                    <div className="flex items-center gap-3 text-white/40 p-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                    </div>
                  ) : songs.length === 0 ? (
                    <div className="text-center text-white/30 py-16">
                      <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      No songs yet. Upload some MP3s above.
                    </div>
                  ) : (
                    <ul>
                      {songs.map((song, idx) => {
                        const raw = song.startsWith("/") ? song.substring(1) : song;
                        const isRenaming = renamingIdx === idx;
                        const isDragTarget = dragOverIdx === idx;

                        return (
                          <li
                            key={`${song}-${idx}`}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragEnter={() => handleDragEnter(idx)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-all group ${
                              isDragTarget ? "drag-over" : "hover:bg-white/5"
                            } ${isUploading && uploadingIdx === idx ? "opacity-50" : ""}`}
                          >
                            {/* Drag handle */}
                            <span className="text-white/20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </span>

                            {/* Index */}
                            <span className="text-white/30 font-mono text-sm w-6 text-center shrink-0">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            {/* Name / rename input */}
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRename(idx);
                                    if (e.key === "Escape") setRenamingIdx(null);
                                  }}
                                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/40"
                                />
                              ) : (
                                <span className="block truncate text-sm">
                                  {cleanSongName(raw)}
                                  <span className="ml-2 text-white/20 text-xs font-mono hidden sm:inline">
                                    {raw}
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isRenaming ? (
                                <>
                                  <button
                                    onClick={() => commitRename(idx)}
                                    disabled={savingRename}
                                    className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                    title="Save"
                                  >
                                    {savingRename ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setRenamingIdx(null)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 transition-all"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startRename(idx)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                    title="Rename"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSong(raw)}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-white/30 py-20 border border-white/10 border-dashed rounded-2xl">
                No playlists found. Create one in the Playlists tab first.
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Edit Playlist Modal ────────────────────────────────────────────── */}
      {editingFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingFolder(null);
          }}
        >
          <div className="bg-[#141414] border border-white/15 rounded-3xl w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="font-bold text-lg">Edit Playlist</h2>
              <button
                onClick={() => setEditingFolder(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-white/50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Cover image picker */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/5 shrink-0">
                  <img
                    src={editCoverPreview}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.png";
                    }}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <p className="font-medium text-sm">Cover Image</p>
                  <p className="text-white/40 text-xs mt-0.5">JPEG, PNG or WebP</p>
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="mt-2 text-xs text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Change cover
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverPick}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-widest block mb-2">
                  Playlist Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter title…"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 placeholder:text-white/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-widest block mb-2">
                  Description
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Optional description…"
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 placeholder:text-white/20 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setEditingFolder(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
              >
                {savingEdit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
