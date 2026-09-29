import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === "1";
const vercelError = () => NextResponse.json(
  { error: "Admin panel only works locally. Run 'npm run dev' on your Mac to upload songs." },
  { status: 403 }
);

// GET — stats
export async function GET() {
  try {
    const songsDir = path.join(process.cwd(), 'public', 'songs');
    if (!fs.existsSync(songsDir))
      return NextResponse.json({ folders: 0, songs: 0, totalSizeMB: 0, folderStats: [] });
    const entries = fs.readdirSync(songsDir, { withFileTypes: true });
    const folders = entries.filter(d => d.isDirectory() && !d.name.startsWith('.'));
    let totalSongs = 0, totalSize = 0;
    const folderStats: { name: string; title: string; songCount: number; sizeMB: number }[] = [];
    for (const folder of folders) {
      const folderPath = path.join(songsDir, folder.name);
      const files = fs.readdirSync(folderPath);
      const mp3Files = files.filter(f => f.toLowerCase().endsWith('.mp3'));
      let folderSize = 0;
      for (const file of mp3Files) {
        try { folderSize += fs.statSync(path.join(folderPath, file)).size; } catch { /* skip unreadable */ }
      }
      totalSongs += mp3Files.length;
      totalSize += folderSize;
      let title = folder.name;
      const infoPath = path.join(folderPath, 'info.json');
      if (fs.existsSync(infoPath)) {
        try { const i = JSON.parse(fs.readFileSync(infoPath, 'utf8')); title = i.title || i.tital || folder.name; } catch { /* use folder name */ }
      }
      folderStats.push({ name: folder.name, title, songCount: mp3Files.length, sizeMB: Math.round(folderSize / 1024 / 1024 * 100) / 100 });
    }
    return NextResponse.json({ folders: folders.length, songs: totalSongs, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100, folderStats });
  } catch {
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

// POST — upload song
export async function POST(req: Request) {
  if (isVercel) return vercelError();
  try {
    const formData = await req.formData();
    const folder = formData.get('folder') as string;
    const file = formData.get('file') as File | null;
    if (!folder || !file) return NextResponse.json({ error: "Missing folder or file" }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    if (!fs.existsSync(folderPath)) return NextResponse.json({ error: "Folder does not exist" }, { status: 404 });
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_ ()]/g, "");
    fs.writeFileSync(path.join(folderPath, safeFilename), Buffer.from(await file.arrayBuffer()));
    const playlistPath = path.join(folderPath, 'playlist.json');
    let playlist: string[] = [];
    if (fs.existsSync(playlistPath)) {
      try { playlist = JSON.parse(fs.readFileSync(playlistPath, 'utf8')); } catch { /* start fresh */ }
    }
    if (!playlist.includes(safeFilename)) {
      playlist.push(safeFilename);
      fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
    }
    return NextResponse.json({ success: true, file: safeFilename });
  } catch {
    return NextResponse.json({ error: "Failed to upload song" }, { status: 500 });
  }
}

// DELETE — delete song (body: { folder, filename })
export async function DELETE(req: Request) {
  if (isVercel) return vercelError();
  try {
    const { folder, filename } = await req.json();
    if (!folder || !filename) return NextResponse.json({ error: "Missing folder or filename" }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    const filePath = path.join(folderPath, filename);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });
    fs.unlinkSync(filePath);
    const playlistPath = path.join(folderPath, 'playlist.json');
    if (fs.existsSync(playlistPath)) {
      try {
        let pl: string[] = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
        pl = pl.filter(s => s !== filename);
        fs.writeFileSync(playlistPath, JSON.stringify(pl, null, 2));
      } catch { /* ignore playlist update failure */ }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
  }
}

// PATCH — rename song (body: { folder, oldFilename, newFilename })
export async function PATCH(req: Request) {
  if (isVercel) return vercelError();
  try {
    const { folder, oldFilename, newFilename } = await req.json();
    if (!folder || !oldFilename || !newFilename)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    const oldPath = path.join(folderPath, oldFilename);
    const newPath = path.join(folderPath, newFilename);
    if (!fs.existsSync(oldPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (fs.existsSync(newPath)) return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    fs.renameSync(oldPath, newPath);
    const playlistPath = path.join(folderPath, 'playlist.json');
    if (fs.existsSync(playlistPath)) {
      try {
        let pl: string[] = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
        pl = pl.map(s => {
          const b = s.startsWith('/') ? s.substring(1) : s;
          return b === oldFilename ? (s.startsWith('/') ? `/${newFilename}` : newFilename) : s;
        });
        fs.writeFileSync(playlistPath, JSON.stringify(pl, null, 2));
      } catch { /* ignore playlist update failure */ }
    }
    return NextResponse.json({ success: true, newFilename });
  } catch {
    return NextResponse.json({ error: 'Failed to rename song' }, { status: 500 });
  }
}

// PUT — reorder songs (body: { folder, songs })
export async function PUT(req: Request) {
  if (isVercel) return vercelError();
  try {
    const { folder, songs } = await req.json();
    if (!folder || !Array.isArray(songs))
      return NextResponse.json({ error: 'Missing folder or songs array' }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    if (!fs.existsSync(folderPath)) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    fs.writeFileSync(path.join(folderPath, 'playlist.json'), JSON.stringify(songs, null, 2));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reorder songs' }, { status: 500 });
  }
}
