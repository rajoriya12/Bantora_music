import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-server";

async function scrapeYouTubeTracks(q: string) {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
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
      return uniqueIds.slice(0, 20).map((id, index) => ({
        id: `yt-${id}`,
        name: `${q} Track #${index + 1}`,
        artists: [{ name: "YouTube Music" }],
        album: {
          name: q,
          images: [{ url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }],
        },
        duration_ms: 180000,
        uri: id,
        source: "youtube" as const,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

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
  } catch {
    // Fall back
  }

  // 2. Try YouTube API Key if configured
  const ytApiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (ytApiKey) {
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
        if (tracks.length > 0) {
          return NextResponse.json({ tracks });
        }
      }
    } catch {
      // Fall back
    }
  }

  // 3. Fallback to web search scraper if Spotify returns 403 and YouTube API key is rate limited
  const scrapedTracks = await scrapeYouTubeTracks(q);
  return NextResponse.json({ tracks: scrapedTracks });
}
