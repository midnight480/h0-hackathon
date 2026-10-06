import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/browse(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/@(.*)",
  "/s/(.*)",
  "/privacy",
  "/terms",
  "/security",
  "/monitoring(.*)", // Sentry トンネルルート
  "/opengraph-image(.*)", // OGP 画像（SNS クローラがアクセス）
  "/twitter-image(.*)",
  "/api/decks/(.*)/view", // ユニークView計測（匿名も送信するため公開。権限制御はルート側で実施）
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
