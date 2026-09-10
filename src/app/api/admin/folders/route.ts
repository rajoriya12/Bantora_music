import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const songsDir = path.join(process.cwd(), 'public', 'songs');
    if (!fs.existsSync(songsDir)) {
      fs.mkdirSync(songsDir, { recursive: true });
    }

    const entries = fs.readdirSync(songsDir, { withFileTypes: true });
    const folders = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => !name.startsWith('.')); // Ignore hidden folders

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Error reading folders:", error);
    return NextResponse.json({ error: "Failed to read folders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { folderName } = await req.json();
    
    if (!folderName || typeof folderName !== 'string') {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    // Sanitize folder name
    const safeFolderName = folderName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    
    if (!safeFolderName) {
      return NextResponse.json({ error: "Invalid folder name after sanitization" }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', safeFolderName);

    if (fs.existsSync(folderPath)) {
      return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
    }

    // Create folder and initial files
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, 'playlist.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(folderPath, 'info.json'), JSON.stringify({ title: folderName }));

    return NextResponse.json({ success: true, folder: safeFolderName });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
