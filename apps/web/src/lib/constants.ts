/** localStorage'da JWT token'ını saklayan anahtar */
export const AUTH_TOKEN_KEY = 'cubiq_token';

/** API base URL — NEXT_PUBLIC_API_URL ortam değişkeninden okunur */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
