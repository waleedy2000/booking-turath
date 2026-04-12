import { NextResponse } from "next/server"

let TOKENS: string[] = []

export async function POST(req: Request) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 400 })
  }

  if (!TOKENS.includes(token)) {
    TOKENS.push(token)
  }

  console.log("TOKENS:", TOKENS)

  return NextResponse.json({ success: true, tokens: TOKENS })
}