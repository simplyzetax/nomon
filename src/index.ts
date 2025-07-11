import { Hono } from 'hono';

import { DNSParser } from './utils/dns/parser';
import { DNSResponse } from './utils/dns/response';
import { Logger } from './utils/logger';
import { DOH_ENDPOINT, DOH_JSON_ENDPOINT, DNS_MESSAGE_CONTENT_TYPE, DNS_JSON_CONTENT_TYPE } from './utils/constants';
import { DNSStorage } from './durable-objects/storage';
import type { DNSQuestion } from './types/dns';
import {
	generateCacheKey,
	getCachedResponse,
	extractTTLFromResponse,
	cacheResponse,
	CACHE_NAME,
	DEFAULT_CACHE_TTL,
	MAX_CACHE_TTL,
} from './utils/cache';

export { DNSStorage } from './durable-objects/storage';

const app = new Hono<{
	Bindings: {
		DNS_STORAGE: DurableObjectNamespace<DNSStorage>;
	};
}>();

app.get('/stats', async (c) => {
	const colo = c.req.raw.cf?.colo;
	if (!colo || typeof colo !== 'string') {
		return c.json({ error: 'Invalid request' }, 400);
	}
	const coloId = c.env.DNS_STORAGE.idFromName(colo);
	const storage = c.env.DNS_STORAGE.get(coloId);
	const stats = await storage.getStatistics();

	let cacheStats = {};
	try {
		const cache = await caches.open(CACHE_NAME);
		cacheStats = {
			cacheEnabled: true,
			cacheName: CACHE_NAME,
			defaultTTL: DEFAULT_CACHE_TTL,
			maxTTL: MAX_CACHE_TTL,
		};
	} catch (error) {
		cacheStats = {
			cacheEnabled: false,
			error: 'Cache not available',
		};
	}

	return c.json({
		statistics: stats,
		cacheStats,
	});
});

app.get('*', async (c) => {
	const colo = c.req.raw.cf?.colo;
	if (!colo || typeof colo !== 'string') {
		return c.json({ error: 'Invalid request' }, 400);
	}

	const coloId = c.env.DNS_STORAGE.idFromName(colo);

	const dns = c.req.query('dns');
	if (dns) {
		const startTime = Date.now();
		try {
			const parsedQuery = DNSParser.parseBase64Query(dns);
			DNSParser.logQuery(parsedQuery);

			const cacheKey = generateCacheKey(parsedQuery.questions);

			const storage = c.env.DNS_STORAGE.get(coloId);
			const domains = parsedQuery.questions.map((q: DNSQuestion) => q.name);
			const blockingResult = await storage.checkDomains(domains);

			if (blockingResult.blocked) {
				const processingTime = Date.now() - startTime;

				const blockedResponse = DNSResponse.createBlockedResponse(parsedQuery);
				return DNSResponse.createBlockedHttpResponse(blockedResponse);
			}

			const cachedResponse = await getCachedResponse(cacheKey);
			if (cachedResponse) {
				const processingTime = Date.now() - startTime;

				const response = cachedResponse.clone();
				response.headers.set('X-DNS-Cache-Hit', 'true');
				return response;
			}

			const res = await fetch(`${DOH_ENDPOINT}?dns=${dns}`, {
				method: 'GET',
				headers: {
					Accept: DNS_MESSAGE_CONTENT_TYPE,
				},
			});

			if (res.ok) {
				const responseBuffer = await res.arrayBuffer();
				const parsedResponse = DNSParser.parseResponse(Buffer.from(responseBuffer));
				DNSParser.logResponse(parsedResponse);

				const processingTime = Date.now() - startTime;

				const httpResponse = DNSResponse.createUpstreamHttpResponse(responseBuffer, res);

				const ttl = extractTTLFromResponse(responseBuffer);
				await cacheResponse(cacheKey, httpResponse, ttl);

				httpResponse.headers.set('X-DNS-Cache-Hit', 'false');
				return httpResponse;
			}

			return res;
		} catch (error) {
			Logger.error('Error parsing DNS packet:', error);
			return DNSResponse.createErrorResponse('Invalid DNS packet', 400);
		}
	}

	// Handle GET requests with JSON Accept header
	const acceptHeader = c.req.header('Accept');
	if (acceptHeader === DNS_JSON_CONTENT_TYPE) {
		const search = new URL(c.req.url).search;
		const res = await fetch(DOH_JSON_ENDPOINT + search, {
			method: 'GET',
			headers: {
				Accept: DNS_JSON_CONTENT_TYPE,
			},
		});
		return res;
	}

	return c.notFound();
});

app.post('*', async (c) => {
	const contentType = c.req.header('content-type');

	const colo = c.req.raw.cf?.colo;
	if (!colo || typeof colo !== 'string') {
		return c.json({ error: 'Invalid request' }, 400);
	}

	Logger.log('POST request received');
	const coloId = c.env.DNS_STORAGE.idFromName(colo);
	Logger.log('Colo ID:', coloId);

	if (contentType === DNS_MESSAGE_CONTENT_TYPE) {
		const startTime = Date.now();
		try {
			const requestBody = await c.req.arrayBuffer();
			const requestBuffer = Buffer.from(requestBody);
			const parsedQuery = DNSParser.parseRawQuery(requestBuffer);
			DNSParser.logQuery(parsedQuery, 'QUERY (POST)');

			const cacheKey = generateCacheKey(parsedQuery.questions);

			const storage = c.env.DNS_STORAGE.get(coloId);
			const domains = parsedQuery.questions.map((q: any) => q.name);
			const blockingResult = await storage.checkDomains(domains);

			if (blockingResult.blocked) {
				const processingTime = Date.now() - startTime;

				const blockedResponse = DNSResponse.createBlockedResponse(parsedQuery);
				return DNSResponse.createBlockedHttpResponse(blockedResponse);
			}

			const cachedResponse = await getCachedResponse(cacheKey);
			if (cachedResponse) {
				const processingTime = Date.now() - startTime;

				const response = cachedResponse.clone();
				response.headers.set('X-DNS-Cache-Hit', 'true');
				return response;
			}

			const res = await fetch(DOH_ENDPOINT, {
				method: 'POST',
				headers: {
					Accept: DNS_MESSAGE_CONTENT_TYPE,
					'Content-Type': DNS_MESSAGE_CONTENT_TYPE,
				},
				body: requestBuffer,
			});

			if (res.ok) {
				const responseBuffer = await res.arrayBuffer();
				const parsedResponse = DNSParser.parseResponse(Buffer.from(responseBuffer));
				DNSParser.logResponse(parsedResponse, 'RESPONSE (POST)');

				const processingTime = Date.now() - startTime;

				const httpResponse = DNSResponse.createUpstreamHttpResponse(responseBuffer, res);

				const ttl = extractTTLFromResponse(responseBuffer);
				await cacheResponse(cacheKey, httpResponse, ttl);

				httpResponse.headers.set('X-DNS-Cache-Hit', 'false');
				return httpResponse;
			}

			return res;
		} catch (error) {
			Logger.error('Error parsing DNS packet:', error);
			return DNSResponse.createErrorResponse('Invalid DNS packet', 400);
		}
	}

	return c.notFound();
});

export default app;
