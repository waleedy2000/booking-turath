import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protect Admin Pages (except login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      return NextResponse.next();
    } catch (err) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 2. Protect Mutating Admin APIs
  const mutatingApiRoutes = [
    { path: '/api/settings', methods: ['PUT'] },
    { path: '/api/departments', methods: ['PUT', 'POST', 'DELETE'] },
    { path: '/api/subscribers', methods: ['POST', 'DELETE'] },
    { path: '/api/participants', methods: ['POST', 'DELETE'] },
    { path: '/api/bookings', methods: ['DELETE'] }, // DO NOT PROTECT POST or GET here!
    { path: '/api/send-notification', methods: ['POST'] },
    { path: '/api/test-sms', methods: ['POST'] },
    { path: '/api/notify', methods: ['POST'] },
  ];

  for (const route of mutatingApiRoutes) {
    if (pathname.startsWith(route.path) && route.methods.includes(request.method)) {
      const token = request.cookies.get('admin_token')?.value;

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        return NextResponse.next();
      } catch (err) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
