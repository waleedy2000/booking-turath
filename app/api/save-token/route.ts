import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/utils/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Check if the token already exists to prevent duplicates
    const { data: existingTokens, error: selectError } = await supabase
      .from("push_tokens")
      .select("id")
      .eq("token", token);

    if (selectError) {
      console.error("Error querying push_tokens:", selectError);
      return NextResponse.json(
        { error: "Database error while validating token" },
        { status: 500 }
      );
    }

    // Add the token only if it is not already stored
    if (!existingTokens || existingTokens.length === 0) {
      const { error: insertError } = await supabase
        .from("push_tokens")
        .insert([{ token }]);

      if (insertError) {
        console.error("Error saving token to Supabase:", insertError);
        return NextResponse.json(
          { error: "Failed to save token" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing save-token request:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}