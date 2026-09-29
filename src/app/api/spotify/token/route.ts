import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { code, code_verifier, redirect_uri } = await request.json();

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFYkey110 || "",
      client_secret: process.env.SPOTIFY_CLIENT_SECRET || process.env.soptifykey || "",
      code_verifier,
    }),
  });

  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error_description || data.error }, { status: 400 });
  return NextResponse.json(data);
}
