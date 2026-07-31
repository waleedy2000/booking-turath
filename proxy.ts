import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/admin-auth';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protect Admin Pages (except login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      const secret = getJwtSecret();
      await jwtVerify(token, secret);
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
    { path: '/api/bookings', methods: ['DELETE', 'PUT'] }, // DO NOT PROTECT POST or GET here!
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
        const secret = getJwtSecret();
        await jwtVerify(token, secret);
        return NextResponse.next();
      } catch (err: any) {
        if (err.message === 'JWT_SECRET_MISSING') {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
