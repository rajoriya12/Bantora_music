import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { folder, oldFilename, newFilename } = await req.json();

    if (!folder || !oldFilename || !newFilename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    const oldPath = path.join(folderPath, oldFilename);
    const newPath = path.join(folderPath, newFilename);

    if (!fs.existsSync(oldPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (fs.existsSync(newPath)) {
      return NextResponse.json({ error: 'A file with that name already exists' }, { status: 409 });
    }

    // Rename the physical file
    fs.renameSync(oldPath, newPath);

    // Update playlist.json
    const playlistPath = path.join(folderPath, 'playlist.json');
    if (fs.existsSync(playlistPath)) {
      try {
        let playlist: string[] = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
        playlist = playlist.map(song => {
          // Handle both "/filename.mp3" and "filename.mp3" formats
          const base = song.startsWith('/') ? song.substring(1) : song;
          if (base === oldFilename) {
            return song.startsWith('/') ? `/${newFilename}` : newFilename;
          }
          return song;
        });
        fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
      } catch (e) {
        console.error('Error updating playlist.json on rename:', e);
      }
    }

    return NextResponse.json({ success: true, newFilename });
  } catch (error) {
    console.error('Error renaming song:', error);
    return NextResponse.json({ error: 'Failed to rename song' }, { status: 500 });
  }
}
