import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ apiKey: process.env.ODYSSEY_API_KEY });
}
