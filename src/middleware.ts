import { withAuth } from "next-auth/middleware";

// Every page except /login requires a signed-in session.
// API routes handle their own auth checks (see src/lib/apiAuth.ts)
// so they are excluded here.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
