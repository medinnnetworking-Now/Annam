import { NextResponse, type NextRequest } from 'next/server';

// A quick gate: no session cookie, no app pages. The real check (database session) runs on every page and action.
export function middleware(req: NextRequest) {
  if (!req.cookies.get('annam_session')) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/patients/:path*', '/queue/:path*', '/cohort/:path*', '/admin/:path*', '/about'] };
