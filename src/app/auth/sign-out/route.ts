import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // This device only, unless the person chose "Sign out on all devices".
  const everywhere = (await request.formData().catch(() => null))?.get("everywhere") === "1";
  await supabase.auth.signOut({ scope: everywhere ? "global" : "local" });
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
