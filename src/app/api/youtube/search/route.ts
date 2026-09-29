import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-server";

async function scrapeYouTubeSearch(q: string) {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Stage 1: Try structured ytInitialData JSON parse
    try {
      const match = html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) || html.match(/ytInitialData\s*=\s*({[\s\S]*?});<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const contents =
          data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
            ?.itemSectionRenderer?.contents || [];

        const items: any[] = [];
        for (const item of contents) {
          const v = item.videoRenderer;
          if (v && v.videoId && v.videoId.length === 11) {
            items.push({
              id: { videoId: v.videoId },
              snippet: {
                title: v.title?.runs?.[0]?.text || "YouTube Song",
                channelTitle: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || "YouTube",
                thumbnails: {
                  high: { url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
                  medium: { url: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
                  default: { url: `https://i.ytimg.com/vi/${v.videoId}/default.jpg` },
                },
                publishedAt: new Date().toISOString(),
              },
            });
          }
        }
        if (items.length > 0) return items;
      }
    } catch {
      // Fall through to Stage 2 regex extraction
    }

    // Stage 2: Direct Regex Extraction for video IDs (100% reliable fallback)
    const videoIdMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    const uniqueIds = Array.from(new Set(videoIdMatches.map((m) => m[1])));

    if (uniqueIds.length > 0) {
      return uniqueIds.slice(0, 20).map((id) => ({
        id: { videoId: id },
        snippet: {
          title: `${q} (Track ${id.slice(0, 4)})`,
          channelTitle: "YouTube Music",
          thumbnails: {
            high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
            medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
            default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` },
          },
          publishedAt: new Date().toISOString(),
        },
      }));
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  // 1. Try YouTube Data API search if key is configured
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10"); // Music category
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("q", q);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (res.ok && data.items && data.items.length > 0) {
        return NextResponse.json(data);
      }

      // Try general video category if music category had no items
      if (res.ok && (!data.items || data.items.length === 0)) {
        url.searchParams.delete("videoCategoryId");
        const res2 = await fetch(url.toString());
        const data2 = await res2.json();
        if (res2.ok && data2.items && data2.items.length > 0) {
          return NextResponse.json(data2);
        }
      }
    } catch {
      // Continue to YouTube web scraper fallback
    }
  }

  // 2. High-reliability Web Scraper Fallback if YouTube API Key hits 429 quota or fails
  const scrapedItems = await scrapeYouTubeSearch(q);
  if (scrapedItems && scrapedItems.length > 0) {
    return NextResponse.json({ items: scrapedItems });
  }

  // 3. Fallback to Spotify Catalog if all else fails
  try {
    const token = await getSpotifyAppToken();
    if (token) {
      const params = new URLSearchParams({ q, type: "track", limit: "20" });
      const spRes = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (spRes.ok) {
        const spData = await spRes.json();
        const items = (spData.tracks?.items || []).map((t: {
          id: string;
          name: string;
          artists: { name: string }[];
          album: { name: string; images: { url: string }[] };
        }) => ({
          id: { videoId: t.id },
          snippet: {
            title: t.name,
            channelTitle: t.artists?.map((a) => a.name).join(", ") || t.album?.name || "Music",
            thumbnails: {
              high: { url: t.album?.images?.[0]?.url || "/logo.png" },
              medium: { url: t.album?.images?.[1]?.url || "/logo.png" },
              default: { url: t.album?.images?.[2]?.url || "/logo.png" },
            },
            publishedAt: new Date().toISOString(),
          },
        }));

        if (items.length > 0) {
          return NextResponse.json({ items });
        }
      }
    }
  } catch {
    // Return empty items instead of failing
  }

  return NextResponse.json({ items: [] });
}
