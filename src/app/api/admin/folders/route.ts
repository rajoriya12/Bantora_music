import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const VERCEL_ERROR = process.env.VERCEL === "1"
  ? NextResponse.json({ error: "Admin panel only works locally. Run 'npm run dev' on your Mac." }, { status: 403 })
  : null;

// GET — list folders
export async function GET() {
  try {
    const songsDir = path.join(process.cwd(), 'public', 'songs');
    if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
    const entries = fs.readdirSync(songsDir, { withFileTypes: true });
    const folders = entries
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);
    return NextResponse.json({ folders });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read folders" }, { status: 500 });
  }
}

// POST — create folder
export async function POST(req: Request) {
  if (VERCEL_ERROR) return VERCEL_ERROR;
  try {
    const { folderName } = await req.json();
    if (!folderName || typeof folderName !== 'string')
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    const safeName = folderName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!safeName) return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', safeName);
    if (fs.existsSync(folderPath)) return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, 'playlist.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(folderPath, 'info.json'), JSON.stringify({ title: folderName }));
    return NextResponse.json({ success: true, folder: safeName });
  } catch {
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}

// DELETE — delete folder (body: { folder })
export async function DELETE(req: Request) {
  if (VERCEL_ERROR) return VERCEL_ERROR;
  try {
    const { folder } = await req.json();
    if (!folder || typeof folder !== 'string')
      return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });
    const safeName = folder.replace(/[^a-z0-9_-]/g, '');
    if (!safeName || safeName !== folder)
      return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
    const songsDir = path.join(process.cwd(), 'public', 'songs');
    const folderPath = path.join(songsDir, safeName);
    if (!folderPath.startsWith(songsDir))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!fs.existsSync(folderPath))
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    fs.rmSync(folderPath, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}

// PATCH — update folder info/cover (formData: folder, title?, description?, cover?)
export async function PATCH(req: Request) {
  if (VERCEL_ERROR) return VERCEL_ERROR;
  try {
    const formData = await req.formData();
    const folder = formData.get('folder') as string;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const coverFile = formData.get('cover') as File | null;
    if (!folder) return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });
    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    if (!fs.existsSync(folderPath)) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    const infoPath = path.join(folderPath, 'info.json');
    let info: Record<string, string> = {};
    if (fs.existsSync(infoPath)) {
      try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch { info = {}; }
    }
    if (title !== null) info.title = title;
    if (description !== null) info.description = description;
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    if (coverFile && coverFile.size > 0) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(coverFile.type))
        return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
      fs.writeFileSync(path.join(folderPath, 'cover.jpeg'), Buffer.from(await coverFile.arrayBuffer()));
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}
