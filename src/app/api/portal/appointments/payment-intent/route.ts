import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "token is required." }, { status: 400 });
    const result = await convex.action(api.billing.actions.createPaymentIntent, { token });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg =
      typeof (err as { data?: unknown })?.data === "string"
        ? (err as { data: string }).data
        : err instanceof Error
        ? err.message
        : "Failed to create payment intent.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
