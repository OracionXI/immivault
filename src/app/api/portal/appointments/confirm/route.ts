import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { token, paymentIntentId } = await req.json();
    if (!token || !paymentIntentId) {
      return NextResponse.json({ error: "token and paymentIntentId are required." }, { status: 400 });
    }
    await convex.action(api.billing.actions.confirmStripePayment, {
      token,
      stripePaymentIntentId: paymentIntentId,
    });
    return NextResponse.json({ confirmed: true });
  } catch (err: unknown) {
    const msg =
      typeof (err as { data?: unknown })?.data === "string"
        ? (err as { data: string }).data
        : err instanceof Error
        ? err.message
        : "Payment confirmation failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
