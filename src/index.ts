import { Hono } from 'hono';
import { COMPILED_BLOCKLIST, BLOCKLIST_STATS } from 'virtual:compiled-blocklist';

// Import our modular components
import { DNSParser } from './dns/parser.js';
import { DNSResponse } from './dns/response.js';
import { BlocklistLoader } from './blocklist/loader.js';
import { DomainChecker } from './blocklist/checker.js';
import { Logger } from './utils/logger.js';
import { DOH_ENDPOINT, DOH_JSON_ENDPOINT, DNS_MESSAGE_CONTENT_TYPE, DNS_JSON_CONTENT_TYPE } from './utils/constants.js';

const app = new Hono();

// Initialize the blocklist with pre-compiled data
BlocklistLoader.loadCompiledBlocklist(COMPILED_BLOCKLIST, BLOCKLIST_STATS);

// Handle GET requests with dns query parameter (DNS wire format)
app.get('*', async (c) => {
	const dns = c.req.query('dns');
	if (dns) {
		try {
			// Parse the base64 DNS query
			const parsedQuery = DNSParser.parseBase64Query(dns);
			DNSParser.logQuery(parsedQuery);

			// Check if any queried domain should be blocked
			const blockingResult = DomainChecker.checkDNSQuestions(parsedQuery.questions);

			if (blockingResult.blocked) {
				const blockedResponse = DNSResponse.createBlockedResponse(parsedQuery);
				return DNSResponse.createBlockedHttpResponse(blockedResponse);
			}

			// Forward to upstream DNS
			const res = await fetch(`${DOH_ENDPOINT}?dns=${dns}`, {
				method: 'GET',
				headers: {
					Accept: DNS_MESSAGE_CONTENT_TYPE,
				},
			});

			// Parse and log the response
			if (res.ok) {
				const responseBuffer = await res.arrayBuffer();
				const parsedResponse = DNSParser.parseResponse(Buffer.from(responseBuffer));
				DNSParser.logResponse(parsedResponse);

				return DNSResponse.createUpstreamHttpResponse(responseBuffer, res);
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

// Handle POST requests with DNS message content-type
app.post('*', async (c) => {
	const contentType = c.req.header('content-type');
	if (contentType === DNS_MESSAGE_CONTENT_TYPE) {
		try {
			// Parse the raw DNS query
			const requestBody = await c.req.arrayBuffer();
			const requestBuffer = Buffer.from(requestBody);
			const parsedQuery = DNSParser.parseRawQuery(requestBuffer);
			DNSParser.logQuery(parsedQuery, 'QUERY (POST)');

			// Check if any queried domain should be blocked
			const blockingResult = DomainChecker.checkDNSQuestions(parsedQuery.questions);

			if (blockingResult.blocked) {
				const blockedResponse = DNSResponse.createBlockedResponse(parsedQuery);
				return DNSResponse.createBlockedHttpResponse(blockedResponse);
			}

			// Forward to upstream DNS
			const res = await fetch(DOH_ENDPOINT, {
				method: 'POST',
				headers: {
					Accept: DNS_MESSAGE_CONTENT_TYPE,
					'Content-Type': DNS_MESSAGE_CONTENT_TYPE,
				},
				body: requestBuffer,
			});

			// Parse and log the response
			if (res.ok) {
				const responseBuffer = await res.arrayBuffer();
				const parsedResponse = DNSParser.parseResponse(Buffer.from(responseBuffer));
				DNSParser.logResponse(parsedResponse, 'RESPONSE (POST)');

				return DNSResponse.createUpstreamHttpResponse(responseBuffer, res);
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
