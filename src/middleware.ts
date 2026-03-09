import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/signup(.*)",
  "/verify(.*)",
  "/forgot-password(.*)",
  "/invite(.*)",
  "/auth/(.*)",
  "/pay/(.*)",
  "/onboarding(.*)",
  "/waiting(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/login(.*)",
  "/signup(.*)",
  "/forgot-password(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  if (!userId && !isPublicRoute(request))
    return NextResponse.redirect(new URL("/login", request.url));
  if (userId && isAuthRoute(request))
    return NextResponse.redirect(new URL("/dashboard", request.url));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
