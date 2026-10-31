import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get('p') || '+31682403239';
  const name = url.searchParams.get('n') || 'Sameer Goel';
  const rel = url.searchParams.get('r') || "Bride's Brother";
  const target = new URL('/', url.origin);
  target.searchParams.set('code', 'AISH2026');
  target.searchParams.set('phone', phone);
  target.searchParams.set('name', name);
  target.searchParams.set('rel', rel);
  target.searchParams.set('view', 'timeline');
  return NextResponse.redirect(target);
}
