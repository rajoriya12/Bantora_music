import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const songsDir = path.join(process.cwd(), 'public', 'songs');

    if (!fs.existsSync(songsDir)) {
      return NextResponse.json({ folders: 0, songs: 0, totalSizeMB: 0, folderStats: [] });
    }

    const entries = fs.readdirSync(songsDir, { withFileTypes: true });
    const folders = entries.filter(d => d.isDirectory() && !d.name.startsWith('.'));

    let totalSongs = 0;
    let totalSize = 0;
    const folderStats: { name: string; title: string; songCount: number; sizeMB: number }[] = [];

    for (const folder of folders) {
      const folderPath = path.join(songsDir, folder.name);
      const files = fs.readdirSync(folderPath);
      const mp3Files = files.filter(f => f.toLowerCase().endsWith('.mp3'));

      let folderSize = 0;
      for (const file of mp3Files) {
        try {
          const stat = fs.statSync(path.join(folderPath, file));
          folderSize += stat.size;
        } catch {
          // skip unreadable files
        }
      }

      totalSongs += mp3Files.length;
      totalSize += folderSize;

      // Read title from info.json
      let title = folder.name;
      const infoPath = path.join(folderPath, 'info.json');
      if (fs.existsSync(infoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
          title = info.title || info.tital || folder.name;
        } catch {
          // use folder name as fallback
        }
      }

      folderStats.push({
        name: folder.name,
        title,
        songCount: mp3Files.length,
        sizeMB: Math.round((folderSize / 1024 / 1024) * 100) / 100,
      });
    }

    return NextResponse.json({
      folders: folders.length,
      songs: totalSongs,
      totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      folderStats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
