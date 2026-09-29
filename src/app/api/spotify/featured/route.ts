import { NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-server";

export async function GET() {
  const token = await getSpotifyAppToken();
  if (!token) {
    return NextResponse.json(
      { error: "Could not obtain Spotify server access token" },
      { status: 500 }
    );
  }

  try {
    // Fetch new releases from Spotify
    const res = await fetch(
      "https://api.spotify.com/v1/browse/new-releases?country=IN&limit=20",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ albums: [] });
    }

    const data = await res.json();
    const albums = (data.albums?.items || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      artists: a.artists?.map((art: any) => ({ name: art.name })) || [],
      images: a.images || [],
      release_date: a.release_date,
      total_tracks: a.total_tracks,
    }));

    return NextResponse.json({ albums });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
