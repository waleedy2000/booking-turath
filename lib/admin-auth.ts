import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET_MISSING');
  }
  const encoded = new TextEncoder().encode(secret);
  if (encoded.length < 32) {
    throw new Error('JWT_SECRET_MISSING'); // Fallback to same error for unified handling
  }
  return encoded;
}

export async function verifyAdminToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return { valid: false, error: 'No token found' };
  }

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.role !== 'admin') {
      return { valid: false, error: 'Invalid role' };
    }
    
    return { valid: true, payload };
  } catch (err) {
    // Return a generic error to not leak information
    return { valid: false, error: 'Invalid or expired token' };
  }
}

export async function requireAdmin() {
  try {
    const auth = await verifyAdminToken();
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالوصول', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return null; // Return null if authorized
  } catch (err: any) {
    if (err.message === 'JWT_SECRET_MISSING') {
      return NextResponse.json(
        { success: false, message: 'Server configuration error', code: 'SERVER_ERROR' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'غير مصرح لك بالوصول', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
}
