export interface YouTubeVideo {
  id: string; // YouTube Video ID or Track ID
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  source: "youtube";
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  if (!query.trim()) return [];

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        return data.items
          .filter((item: { id?: { videoId?: string } }) => item.id?.videoId)
          .map((item: {
            id: { videoId: string };
            snippet: {
              title: string;
              channelTitle: string;
              thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
              publishedAt: string;
            };
          }) => {
            const cleanTitle = item.snippet.title
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">");

            return {
              id: item.id.videoId,
              title: cleanTitle,
              channelTitle: item.snippet.channelTitle,
              thumbnail:
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.medium?.url ||
                item.snippet.thumbnails?.default?.url ||
                "/logo.png",
              publishedAt: item.snippet.publishedAt || new Date().toISOString(),
              source: "youtube" as const,
            };
          });
      }
    }

    // Secondary client-side fallback to Spotify catalog
    const spRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
    if (spRes.ok) {
      const spData = await spRes.json();
      if (spData.tracks && Array.isArray(spData.tracks)) {
        return spData.tracks.map((t: {
          id: string;
          name: string;
          artists: { name: string }[];
          album: { images: { url: string }[] };
        }) => ({
          id: t.id,
          title: t.name,
          channelTitle: t.artists?.map((a) => a.name).join(", ") || "Music",
          thumbnail: t.album?.images?.[0]?.url || "/logo.png",
          publishedAt: new Date().toISOString(),
          source: "youtube" as const,
        }));
      }
    }
  } catch {
    // Graceful fallback
  }

  return [];
}
