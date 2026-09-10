import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: Request) {
  try {
    const { folder, filename } = await req.json();

    if (!folder || !filename) {
      return NextResponse.json({ error: "Missing folder or filename" }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    const filePath = path.join(folderPath, filename);

    if (!fs.existsSync(folderPath) || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    // Update playlist.json
    const playlistPath = path.join(folderPath, 'playlist.json');
    if (fs.existsSync(playlistPath)) {
      try {
        let playlist: string[] = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
        playlist = playlist.filter(song => song !== filename);
        fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
      } catch (e) {
        console.error("Error updating playlist.json", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting song:", error);
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
  }
}
