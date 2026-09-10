import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { folder, songs } = await req.json();

    if (!folder || !Array.isArray(songs)) {
      return NextResponse.json({ error: 'Missing folder or songs array' }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const playlistPath = path.join(folderPath, 'playlist.json');
    fs.writeFileSync(playlistPath, JSON.stringify(songs, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering songs:', error);
    return NextResponse.json({ error: 'Failed to reorder songs' }, { status: 500 });
  }
}
