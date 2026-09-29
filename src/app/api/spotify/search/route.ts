import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ tracks: [] });
  }

  // 1. Try Spotify search if app token is available
  try {
    const token = await getSpotifyAppToken();
    if (token) {
      const params = new URLSearchParams({ q, type: "track", limit: "20" });
      const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const tracks = (data.tracks?.items || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: t.artists?.map((a: any) => ({ name: a.name })) || [],
          album: {
            name: t.album?.name || "",
            images: t.album?.images || [],
          },
          duration_ms: t.duration_ms,
          uri: t.uri,
          source: "spotify" as const,
        }));
        if (tracks.length > 0) {
          return NextResponse.json({ tracks });
        }
      }
    }
  } catch (err) {
    console.warn("Spotify search fallback to YouTube:", err);
  }

  // 2. Seamless fallback to YouTube API Key
  const ytApiKey =
    process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!ytApiKey) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const ytUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    ytUrl.searchParams.set("part", "snippet");
    ytUrl.searchParams.set("type", "video");
    ytUrl.searchParams.set("maxResults", "20");
    ytUrl.searchParams.set("q", q);
    ytUrl.searchParams.set("key", ytApiKey);

    const ytRes = await fetch(ytUrl.toString());
    if (ytRes.ok) {
      const ytData = await ytRes.json();
      const tracks = (ytData.items || []).map((item: any) => ({
        id: item.id.videoId,
        name: item.snippet.title
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">"),
        artists: [{ name: item.snippet.channelTitle }],
        album: {
          name: item.snippet.channelTitle,
          images: [
            {
              url:
                item.snippet.thumbnails.high?.url ||
                item.snippet.thumbnails.medium?.url ||
                item.snippet.thumbnails.default?.url ||
                "/logo.png",
            },
          ],
        },
        duration_ms: 180000,
        uri: item.id.videoId,
        source: "youtube" as const,
      }));
      return NextResponse.json({ tracks });
    }
  } catch (e) {
    console.error("YouTube search error:", e);
  }

  return NextResponse.json({ tracks: [] });
}
