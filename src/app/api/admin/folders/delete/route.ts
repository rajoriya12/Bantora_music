import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: Request) {
  try {
    const { folder } = await req.json();

    if (!folder || typeof folder !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid folder name' }, { status: 400 });
    }

    // Prevent path traversal attacks
    const safeName = folder.replace(/[^a-z0-9_-]/g, '');
    if (!safeName || safeName !== folder) {
      return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', safeName);

    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Verify it's inside the songs directory (extra safety)
    const songsDir = path.join(process.cwd(), 'public', 'songs');
    if (!folderPath.startsWith(songsDir)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    fs.rmSync(folderPath, { recursive: true, force: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
