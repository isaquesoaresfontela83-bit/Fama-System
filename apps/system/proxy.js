import { NextResponse } from 'next/server';
import { isTrustedMutation } from './lib/request-security';

export function proxy(request) {
    if (!isTrustedMutation(request)) {
        return NextResponse.json({ error: 'Origem da solicitação não autorizada.' }, { status: 403 });
    }
    return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
