import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const folder = formData.get('folder') as string;
    const file = formData.get('file') as File | null;

    if (!folder || !file) {
      return NextResponse.json({ error: "Missing folder or file" }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);

    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: "Folder does not exist" }, { status: 404 });
    }

    // Save the file
    const buffer = Buffer.from(await file.arrayBuffer());
    // Keep original filename or sanitize it slightly
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_ ()]/g, "");
    const filePath = path.join(folderPath, safeFilename);

    fs.writeFileSync(filePath, buffer);

    // Update playlist.json
    const playlistPath = path.join(folderPath, 'playlist.json');
    let playlist: string[] = [];
    
    if (fs.existsSync(playlistPath)) {
      try {
        playlist = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
      } catch (e) {
        playlist = [];
      }
    }

    if (!playlist.includes(safeFilename)) {
      playlist.push(safeFilename);
      fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
    }

    return NextResponse.json({ success: true, file: safeFilename });
  } catch (error) {
    console.error("Error uploading song:", error);
    return NextResponse.json({ error: "Failed to upload song" }, { status: 500 });
  }
}
