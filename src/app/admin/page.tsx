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
  Sparkles,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSongName(track: string) {
  let name = track.split("/").pop() || track;
  name = decodeURIComponent(name).replace(/\.mp3$/i, "");
  name = name
    .replace(/\(pagalworldi\.com\.co\)/gi, "")
    .replace(/\(koshalworld\.com\)/gi, "")
    .replace(/\(mp3\.pm\)/gi, "")
    .replace(/HindiRapsong2021/gi, "");
  return name.replace(/[-_]/g, " ").trim() || track;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-medium animate-slide-up
      ${type === "success"
        ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-900/40"
        : "bg-red-950/90 border-red-500/30 text-red-300 shadow-red-900/40"}`}>
      {type === "success"
        ? <Check className="w-4 h-4 shrink-0" />
        : <AlertTriangle className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, gradient }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-5 flex flex-col gap-4 group hover:border-white/15 transition-all hover:-translate-y-0.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        <p className="text-white/45 text-sm mt-1">{label}</p>
        {sub && <p className="text-white/25 text-xs mt-0.5">{sub}</p>}
      </div>
      {/* Subtle shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [activeTab, setActiveTab]   = useState<Tab>("dashboard");
  const [toast, setToast]           = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [stats, setStats]           = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [folders, setFolders]       = useState<string[]>([]);
  const [folderInfoMap, setFolderInfoMap] = useState<Record<string, FolderInfo>>({});
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [newFolderName, setNewFolderName]   = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  const [editingFolder, setEditingFolder]   = useState<string | null>(null);
  const [editTitle, setEditTitle]           = useState("");
  const [editDesc, setEditDesc]             = useState("");
  const [editCoverFile, setEditCoverFile]   = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string>("");
  const [savingEdit, setSavingEdit]         = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [songs, setSongs]           = useState<string[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [renamingIdx, setRenamingIdx]   = useState<number | null>(null);
  const [renameValue, setRenameValue]   = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [dragOverIdx, setDragOverIdx]   = useState<number | null>(null);
  const dragItemIdx = useRef<number | null>(null);
  const songUploadRef  = useRef<HTMLInputElement>(null);
  const multiUploadRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await fetch("/api/admin/stats");
      if (r.ok) setStats(await r.json());
    } catch { /**/ } finally { setLoadingStats(false); }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/folders");
      if (!r.ok) return;
      const { folders: list = [] }: { folders: string[] } = await r.json();
      setFolders(list);
      if (!selectedFolder && list.length > 0) setSelectedFolder(list[0]);
      const infoMap: Record<string, FolderInfo> = {};
      await Promise.all(list.map(async (f) => {
        try {
          const ir = await fetch(`/songs/${f}/info.json?t=${Date.now()}`);
          const d  = ir.ok ? await ir.json() : {};
          infoMap[f] = { title: d.title || d.tital || f, description: d.description || d.des || "" };
        } catch { infoMap[f] = { title: f, description: "" }; }
      }));
      setFolderInfoMap(infoMap);
    } catch { /**/ }
  }, [selectedFolder]);

  const fetchSongs = useCallback(async (folder: string) => {
    if (!folder) return;
    setLoadingSongs(true);
    try {
      const r = await fetch(`/songs/${folder}/playlist.json?t=${Date.now()}`);
      setSongs(r.ok ? await r.json() : []);
    } catch { setSongs([]); }
    finally { setLoadingSongs(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchFolders(); }, []);
  useEffect(() => { if (selectedFolder) fetchSongs(selectedFolder); }, [selectedFolder]);

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const r = await fetch("/api/admin/folders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName: newFolderName.trim() }),
      });
      const d = await r.json();
      if (d.success) { setNewFolderName(""); await fetchFolders(); setSelectedFolder(d.folder); fetchStats(); notify(`Playlist "${d.folder}" created`); }
      else notify(d.error || "Failed to create playlist", "error");
    } catch { notify("Network error", "error"); }
    finally { setCreatingFolder(false); }
  };

  const handleDeleteFolder = async (folder: string) => {
    if (!confirm(`Delete "${folderInfoMap[folder]?.title || folder}" and ALL its songs? This cannot be undone.`)) return;
    setDeletingFolder(folder);
    try {
      const r = await fetch("/api/admin/folders/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const d = await r.json();
      if (d.success) {
        if (selectedFolder === folder) { const rem = folders.filter(f => f !== folder); setSelectedFolder(rem[0] || ""); }
        await fetchFolders(); fetchStats(); notify("Playlist deleted");
      } else notify(d.error || "Failed to delete", "error");
    } catch { notify("Network error", "error"); }
    finally { setDeletingFolder(null); }
  };

  const openEditModal = (folder: string) => {
    setEditingFolder(folder);
    setEditTitle(folderInfoMap[folder]?.title || folder);
    setEditDesc(folderInfoMap[folder]?.description || "");
    setEditCoverFile(null);
    setEditCoverPreview(`/songs/${folder}/cover.jpeg?t=${Date.now()}`);
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
      const r = await fetch("/api/admin/folders/update", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) { await fetchFolders(); setEditingFolder(null); notify("Playlist updated"); }
      else notify(d.error || "Failed to save", "error");
    } catch { notify("Network error", "error"); }
    finally { setSavingEdit(false); }
  };

  // ── Song upload ───────────────────────────────────────────────────────────

  const uploadFiles = async (files: FileList) => {
    if (!selectedFolder || !files.length) return;
    setIsUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append("folder", selectedFolder);
      fd.append("file", files[i]);
      try {
        const r = await fetch("/api/admin/songs", { method: "POST", body: fd });
        if ((await r.json()).success) ok++;
      } catch { /**/ }
      setUploadProgress({ done: i + 1, total: files.length });
    }
    setIsUploading(false);
    setUploadProgress(null);
    if (songUploadRef.current)  songUploadRef.current.value  = "";
    if (multiUploadRef.current) multiUploadRef.current.value = "";
    await fetchSongs(selectedFolder);
    fetchStats();
    notify(ok === files.length ? `${ok} song${ok > 1 ? "s" : ""} uploaded` : `${ok}/${files.length} uploaded`, ok > 0 ? "success" : "error");
  };

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    const mp3s = Array.from(e.dataTransfer.files).filter(f => f.type.includes("audio"));
    if (!mp3s.length) return;
    const dt = new DataTransfer();
    mp3s.forEach(f => dt.items.add(f));
    uploadFiles(dt.files);
  };

  // ── Song CRUD ─────────────────────────────────────────────────────────────

  const handleDeleteSong = async (filename: string) => {
    if (!confirm(`Delete "${cleanSongName(filename)}"?`)) return;
    try {
      const r = await fetch("/api/admin/songs/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, filename }),
      });
      const d = await r.json();
      if (d.success) { await fetchSongs(selectedFolder); fetchStats(); notify("Song deleted"); }
      else notify(d.error || "Failed to delete", "error");
    } catch { notify("Network error", "error"); }
  };

  const startRename = (idx: number) => {
    const raw  = songs[idx];
    const base = raw.startsWith("/") ? raw.substring(1) : raw;
    setRenamingIdx(idx);
    setRenameValue(base.replace(/\.mp3$/i, ""));
  };

  const commitRename = async (idx: number) => {
    if (!renameValue.trim()) { setRenamingIdx(null); return; }
    const raw  = songs[idx];
    const old  = raw.startsWith("/") ? raw.substring(1) : raw;
    const next = renameValue.trim().replace(/\.mp3$/i, "") + ".mp3";
    if (next === old) { setRenamingIdx(null); return; }
    setSavingRename(true);
    try {
      const r = await fetch("/api/admin/songs/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, oldFilename: old, newFilename: next }),
      });
      const d = await r.json();
      if (d.success) { await fetchSongs(selectedFolder); notify("Song renamed"); }
      else notify(d.error || "Failed to rename", "error");
    } catch { notify("Network error", "error"); }
    finally { setSavingRename(false); setRenamingIdx(null); }
  };

  const handleDragStart = (idx: number) => { dragItemIdx.current = idx; };
  const handleDragEnter = (idx: number) => { setDragOverIdx(idx); };
  const handleDragEnd   = async () => {
    if (dragItemIdx.current === null || dragOverIdx === null || dragItemIdx.current === dragOverIdx) {
      dragItemIdx.current = null; setDragOverIdx(null); return;
    }
    const list = [...songs];
    const [moved] = list.splice(dragItemIdx.current, 1);
    list.splice(dragOverIdx, 0, moved);
    setSongs(list);
    dragItemIdx.current = null; setDragOverIdx(null);
    try {
      await fetch("/api/admin/songs/reorder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, songs: list }),
      });
      notify("Order saved");
    } catch { notify("Failed to save order", "error"); fetchSongs(selectedFolder); }
  };

  // ── Nav items ──────────────────────────────────────────────────────────────

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "playlists", label: "Playlists",  icon: FolderOpen },
    { id: "songs",     label: "Songs",      icon: Music2 },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col md:flex-row selection:bg-purple-500/20">
      <style>{`
        @keyframes slide-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16,1,0.3,1); }
        .drag-over { outline:2px dashed rgba(168,85,247,0.5); outline-offset:-2px; background:rgba(168,85,247,0.06); }
        .tab-active { background:rgba(168,85,247,0.15); border-color:rgba(168,85,247,0.3); color:#fff; }
      `}</style>

      {/* ── Ambient background ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-purple-800/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-indigo-800/10 blur-[100px]" />
      </div>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="relative z-10 w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex md:flex-col px-4 py-4 md:py-6 gap-1 overflow-x-auto md:overflow-visible bg-[#070709]/80 backdrop-blur-xl">
        {/* Logo */}
        <div className="hidden md:flex items-center gap-3 px-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/50">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-base tracking-tight">Bantora</p>
            <p className="text-white/35 text-[11px]">Admin</p>
          </div>
        </div>

        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 border
              ${activeTab === id
                ? "tab-active"
                : "border-transparent text-white/45 hover:text-white hover:bg-white/6"}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}

        <div className="hidden md:block mt-auto">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 hover:text-white hover:bg-white/6 border border-transparent transition-all">
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to Player
          </Link>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 min-h-screen overflow-y-auto p-6 md:p-10">

        {/* ──────────────── DASHBOARD ──────────────── */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto space-y-10 animate-slide-up">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
              <p className="text-white/35 text-sm mt-1">Your Bantora library at a glance</p>
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 rounded-2xl shimmer" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Playlists"        value={stats.folders}       icon={Layers}    gradient="from-violet-500 to-purple-700" />
                  <StatCard label="Total Songs"      value={stats.songs}         icon={ListMusic} gradient="from-indigo-500 to-blue-700" />
                  <StatCard label="Storage Used"     value={`${stats.totalSizeMB} MB`} icon={HardDrive} gradient="from-amber-500 to-orange-600" />
                  <StatCard label="Avg per Playlist" value={stats.folders > 0 ? Math.round(stats.songs / stats.folders) : 0} sub="songs" icon={Music2} gradient="from-emerald-500 to-teal-700" />
                </div>

                <div>
                  <h2 className="text-base font-bold mb-4 text-white/70">Playlists Breakdown</h2>
                  <div className="space-y-2">
                    {stats.folderStats.map(fs => (
                      <div key={fs.name} className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-white/12 hover:bg-white/[0.05] transition-all group">
                        <img
                          src={`/songs/${fs.name}/cover.jpeg`}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-white/10"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{fs.title}</p>
                          <p className="text-white/30 text-xs font-mono">{fs.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{fs.songCount}</p>
                          <p className="text-white/30 text-xs">songs</p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="font-bold text-sm">{fs.sizeMB} MB</p>
                          <p className="text-white/30 text-xs">size</p>
                        </div>
                        <button
                          onClick={() => { setSelectedFolder(fs.name); setActiveTab("songs"); }}
                          className="p-2 rounded-xl text-white/25 hover:text-white hover:bg-white/8 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {!stats.folderStats.length && (
                      <p className="text-white/25 text-sm">No playlists yet.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-white/25">Could not load stats.</p>
            )}
          </div>
        )}

        {/* ──────────────── PLAYLISTS ──────────────── */}
        {activeTab === "playlists" && (
          <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Playlists</h1>
              <p className="text-white/35 text-sm mt-1">Create, edit, and delete your playlists</p>
            </div>

            {/* Create */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
              <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-white/35 mb-4 flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> New Playlist
              </p>
              <form onSubmit={handleCreateFolder} className="flex gap-3">
                <input
                  type="text"
                  placeholder="e.g. chill-vibes"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 placeholder:text-white/20 transition-colors"
                />
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-purple-900/40"
                >
                  {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </form>
              <p className="text-white/20 text-xs mt-2">Lowercase letters, numbers, hyphens, underscores only.</p>
            </div>

            {/* Grid */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-white/35 mb-4">
                {folders.length} Playlist{folders.length !== 1 ? "s" : ""}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {folders.map(folder => (
                  <div key={folder} className="group relative bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/15 transition-all hover:-translate-y-0.5">
                    {/* Cover */}
                    <div className="relative aspect-square bg-black/20">
                      <img
                        src={`/songs/${folder}/cover.jpeg?t=${Date.now()}`}
                        onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt=""
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                        <button onClick={() => openEditModal(folder)} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-all hover:scale-110" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedFolder(folder); setActiveTab("songs"); }} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-all hover:scale-110" title="Songs">
                          <Music2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteFolder(folder)} disabled={deletingFolder === folder} className="w-10 h-10 rounded-full bg-red-500/25 hover:bg-red-500/40 backdrop-blur flex items-center justify-center transition-all hover:scale-110" title="Delete">
                          {deletingFolder === folder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-300" />}
                        </button>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <p className="font-bold truncate text-sm">{folderInfoMap[folder]?.title || folder}</p>
                      <p className="text-white/30 text-xs font-mono mt-0.5">{folder}</p>
                      {folderInfoMap[folder]?.description && (
                        <p className="text-white/40 text-xs mt-1.5 line-clamp-2">{folderInfoMap[folder].description}</p>
                      )}
                    </div>
                  </div>
                ))}
                {!folders.length && (
                  <div className="col-span-full text-center text-white/20 py-16 border border-white/6 border-dashed rounded-2xl">
                    No playlists yet. Create one above.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── SONGS ──────────────── */}
        {activeTab === "songs" && (
          <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Songs</h1>
              <p className="text-white/35 text-sm mt-1">Upload, rename, reorder, and delete songs</p>
            </div>

            {/* Playlist chips */}
            <div className="flex flex-wrap gap-2">
              {folders.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFolder(f)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all border
                    ${selectedFolder === f
                      ? "bg-purple-500/20 border-purple-500/40 text-white shadow-lg shadow-purple-900/30"
                      : "border-white/8 text-white/45 hover:text-white hover:border-white/20 hover:bg-white/5"}`}
                >
                  {folderInfoMap[f]?.title || f}
                </button>
              ))}
            </div>

            {selectedFolder ? (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDropZone}
                  className="border-2 border-dashed border-white/10 hover:border-purple-500/40 rounded-2xl p-8 text-center transition-all hover:bg-purple-500/[0.03] group"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      <p className="text-white/50 text-sm">
                        Uploading {uploadProgress?.done}/{uploadProgress?.total}…
                      </p>
                      {uploadProgress && (
                        <div className="w-48 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full progress-bar rounded-full transition-all duration-300"
                            style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-white/25 group-hover:text-purple-400 mb-3 transition-colors" />
                      <p className="text-white/40 text-sm mb-4">Drag & drop MP3 files, or click to browse</p>
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <input type="file" accept="audio/mp3,audio/mpeg" onChange={e => e.target.files && uploadFiles(e.target.files)} ref={songUploadRef} className="hidden" id="single-upload" />
                        <label htmlFor="single-upload" className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer hover:opacity-90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-900/30">
                          <Upload className="w-4 h-4" /> Upload MP3
                        </label>
                        <input type="file" accept="audio/mp3,audio/mpeg" multiple onChange={e => e.target.files && uploadFiles(e.target.files)} ref={multiUploadRef} className="hidden" id="multi-upload" />
                        <label htmlFor="multi-upload" className="flex items-center gap-2 bg-white/8 border border-white/10 px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer hover:bg-white/12 transition-all">
                          <Plus className="w-4 h-4" /> Upload Multiple
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {/* Song list */}
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                    <h2 className="font-bold text-sm">{folderInfoMap[selectedFolder]?.title || selectedFolder}</h2>
                    <span className="text-white/30 text-sm">
                      {songs.length} song{songs.length !== 1 ? "s" : ""}
                      {songs.length > 0 && <span className="ml-2 text-white/15 text-xs">drag to reorder</span>}
                    </span>
                  </div>

                  {loadingSongs ? (
                    <div className="space-y-px">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 shimmer" />
                      ))}
                    </div>
                  ) : !songs.length ? (
                    <div className="text-center text-white/20 py-16">
                      <Music2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      No songs yet. Upload some MP3s above.
                    </div>
                  ) : (
                    <ul>
                      {songs.map((song, idx) => {
                        const raw       = song.startsWith("/") ? song.substring(1) : song;
                        const isRen     = renamingIdx === idx;
                        const isDragTgt = dragOverIdx === idx;
                        return (
                          <li
                            key={`${song}-${idx}`}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragEnter={() => handleDragEnter(idx)}
                            onDragEnd={handleDragEnd}
                            onDragOver={e => e.preventDefault()}
                            className={`flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] last:border-0 transition-all group
                              ${isDragTgt ? "drag-over" : "hover:bg-white/[0.03]"}`}
                          >
                            {/* Drag handle */}
                            <GripVertical className="w-4 h-4 text-white/15 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />

                            {/* Index */}
                            <span className="text-white/20 font-mono text-xs w-5 text-center shrink-0">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              {isRen ? (
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") commitRename(idx); if (e.key === "Escape") setRenamingIdx(null); }}
                                  className="w-full bg-black/50 border border-purple-500/40 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-500/70"
                                />
                              ) : (
                                <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors truncate block">
                                  {cleanSongName(raw)}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              {isRen ? (
                                <>
                                  <button onClick={() => commitRename(idx)} disabled={savingRename} className="p-2 rounded-lg hover:bg-emerald-500/15 text-emerald-400 transition-all">
                                    {savingRename ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => setRenamingIdx(null)} className="p-2 rounded-lg hover:bg-white/8 text-white/40 transition-all">
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startRename(idx)} className="p-2 rounded-lg hover:bg-white/8 text-white/20 hover:text-white/70 opacity-0 group-hover:opacity-100 transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteSong(raw)} className="p-2 rounded-lg hover:bg-red-500/15 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
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
              <div className="text-center text-white/20 py-20 border border-white/6 border-dashed rounded-2xl">
                No playlists found. Create one in the Playlists tab first.
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setEditingFolder(null); }}>
          <div className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl shadow-black/60 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
              <h2 className="font-bold">Edit Playlist</h2>
              <button onClick={() => setEditingFolder(null)} className="p-2 rounded-xl hover:bg-white/8 text-white/40 transition-all hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Cover */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/5 shrink-0 ring-1 ring-white/10">
                  <img src={editCoverPreview} onError={e => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => coverInputRef.current?.click()} className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImagePlus className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <p className="font-medium text-sm">Cover Image</p>
                  <p className="text-white/35 text-xs mt-0.5">JPEG, PNG or WebP</p>
                  <button onClick={() => coverInputRef.current?.click()} className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    Change cover →
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) { setEditCoverFile(f); setEditCoverPreview(URL.createObjectURL(f)); } }} className="hidden" />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/35 block mb-2">Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-black/40 border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 placeholder:text-white/20 transition-colors" />
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/35 block mb-2">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} placeholder="Optional…" className="w-full bg-black/40 border border-white/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 placeholder:text-white/20 resize-none transition-colors" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/[0.07]">
              <button onClick={() => setEditingFolder(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-white/6 transition-all">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-purple-900/30">
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
