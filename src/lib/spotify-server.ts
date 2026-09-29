let cachedAppToken: string | null = null;
let tokenExpiresAt = 0;

export async function getSpotifyAppToken(): Promise<string | null> {
  if (cachedAppToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAppToken;
  }

  const clientId =
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.SPOTIFYkey110;
  const clientSecret =
    process.env.SPOTIFY_CLIENT_SECRET || process.env.soptifykey;

  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Spotify token request failed with status", res.status);
      return null;
    }
    const data = await res.json();
    cachedAppToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedAppToken;
  } catch (err) {
    console.error("Failed to get Spotify app token:", err);
    return null;
  }
}
