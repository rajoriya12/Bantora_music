import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const folder = formData.get('folder') as string;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const coverFile = formData.get('cover') as File | null;

    if (!folder) {
      return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), 'public', 'songs', folder);
    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Update info.json
    const infoPath = path.join(folderPath, 'info.json');
    let info: Record<string, string> = {};
    if (fs.existsSync(infoPath)) {
      try {
        info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      } catch {
        info = {};
      }
    }

    if (title !== null) info.title = title;
    if (description !== null) info.description = description;
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));

    // Update cover image if provided
    if (coverFile && coverFile.size > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(coverFile.type)) {
        return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 });
      }
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      fs.writeFileSync(path.join(folderPath, 'cover.jpeg'), buffer);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating folder info:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}
