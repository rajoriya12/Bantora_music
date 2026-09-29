import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { refresh_token } = await request.json();

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: process.env.SPOTIFYkey110!,
      client_secret: process.env.soptifykey!,
    }),
  });

  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error_description || data.error }, { status: 400 });
  return NextResponse.json(data);
}
