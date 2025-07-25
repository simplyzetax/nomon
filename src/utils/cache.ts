import { DNSParser } from './dns/parser';
import { Logger } from './logger';
import type { DNSQuestion } from '../types/dns';

// Cache configuration
export const CACHE_NAME = 'dns-cache';
export const DEFAULT_CACHE_TTL = 300; // 5 minutes default
export const MAX_CACHE_TTL = 3600; // 1 hour max

export function generateCacheKey(questions: DNSQuestion[]): string {
	// Create a deterministic cache key based on the DNS questions
	const queryParams = questions
		.map((q) => `${q.name.toLowerCase()}:${q.type}:${q.class || 'IN'}`)
		.sort()
		.join('|');

	// Create a valid URL for the cache key
	// Use a dummy domain with the query as search params
	const url = new URL('https://dns-cache.local/query');
	url.searchParams.set('q', queryParams);
	return url.toString();
}

export function extractTTLFromResponse(responseBuffer: ArrayBuffer): number {
	try {
		const parsedResponse = DNSParser.parseResponse(Buffer.from(responseBuffer));
		if (parsedResponse.answers && parsedResponse.answers.length > 0) {
			// Use the minimum TTL from all answers, capped at MAX_CACHE_TTL
			const minTTL = Math.min(...parsedResponse.answers.map((answer) => answer.ttl));
			return Math.min(minTTL, MAX_CACHE_TTL);
		}
	} catch (error) {
		Logger.error('Error extracting TTL from response:', error);
	}
	return DEFAULT_CACHE_TTL;
}

export async function getCachedResponse(cacheKey: string): Promise<Response | null> {
	try {
		const cache = await caches.open(CACHE_NAME);
		const request = new Request(cacheKey);
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		return null;
	} catch (error) {
		Logger.error('Error checking cache:', error);
		return null;
	}
}

export async function cacheResponse(cacheKey: string, response: Response, ttl: number): Promise<void> {
	try {
		const cache = await caches.open(CACHE_NAME);
		const responseToCache = response.clone();

		// Add cache headers
		const headers = new Headers(responseToCache.headers);
		headers.set('Cache-Control', `public, max-age=${ttl}`);
		headers.set('X-DNS-Cache-TTL', ttl.toString());
		headers.set('X-DNS-Cached-At', new Date().toISOString());

		const cachedResponse = new Response(responseToCache.body, {
			status: responseToCache.status,
			statusText: responseToCache.statusText,
			headers: headers,
		});

		const request = new Request(cacheKey);
		await cache.put(request, cachedResponse);
	} catch (error) {
		Logger.error('Error caching response:', error);
	}
}
