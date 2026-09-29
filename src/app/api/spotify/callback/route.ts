import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify_error=access_denied", request.url));
  }

  return NextResponse.redirect(new URL(`/?spotify_code=${code}`, request.url));
}
