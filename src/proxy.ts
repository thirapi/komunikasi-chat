import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    const session = request.cookies.get('session_id')

    const protectedPaths = ['/channels', '/admin']

    const isProtected = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    )

    if (isProtected && !session) {
        // Remember where the user was going so login can send them back.
        const loginUrl = new URL('/', request.url)
        const target = request.nextUrl.pathname + request.nextUrl.search
        if (target !== '/channels/default') loginUrl.searchParams.set('callbackUrl', target)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/channels/:path*', '/admin/:path*'],
}