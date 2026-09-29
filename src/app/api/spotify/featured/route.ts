import { NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-server";

async function scrapeFeaturedAlbums() {
  try {
    const res = await fetch("https://www.youtube.com/results?search_query=Top+Bollywood+Music+Jukebox", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const videoIdMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    const uniqueIds = Array.from(new Set(videoIdMatches.map((m) => m[1])));

    if (uniqueIds.length > 0) {
      return uniqueIds.slice(0, 10).map((id, index) => ({
        id: `feat-${id}`,
        name: `Featured Collection #${index + 1}`,
        artists: [{ name: "Bantora Music" }],
        images: [{ url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }],
        release_date: "2026",
        total_tracks: 10,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const token = await getSpotifyAppToken();
    if (token) {
      const res = await fetch(
        "https://api.spotify.com/v1/browse/new-releases?country=IN&limit=20",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const albums = (data.albums?.items || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          artists: a.artists?.map((art: any) => ({ name: art.name })) || [],
          images: a.images || [],
          release_date: a.release_date,
          total_tracks: a.total_tracks,
        }));

        if (albums.length > 0) {
          return NextResponse.json({ albums });
        }
      }
    }
  } catch {
    // Fall back
  }

  const albums = await scrapeFeaturedAlbums();
  return NextResponse.json({ albums });
}
