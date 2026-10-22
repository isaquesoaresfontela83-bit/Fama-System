'use client';
import { useLayoutEffect } from 'react';
import { installAccountSessionGuard } from '@/lib/account-switcher-client';
export function useAccountSession(userId) {
    useLayoutEffect(() => userId ? installAccountSessionGuard(window, userId) : undefined, [userId]);
}
