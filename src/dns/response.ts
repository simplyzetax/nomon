import dnsPacket from 'dns-packet';
import { ParsedDNSQuery, DNSResponseOptions } from '../types/dns.js';
import {
	BLOCKED_RESPONSE_TTL,
	BLOCKED_IPV4_ADDRESS,
	BLOCKED_IPV6_ADDRESS,
	DNS_RECORD_TYPES,
	DNS_MESSAGE_CONTENT_TYPE,
	BLOCKED_RESPONSE_CACHE_CONTROL,
} from '../utils/constants.js';

export class DNSResponse {
	/**
	 * Create a blocked DNS response for the given query
	 */
	static createBlockedResponse(originalQuery: ParsedDNSQuery): Buffer {
		const response = {
			id: originalQuery.id,
			type: 'response' as const,
			flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE,
			questions: originalQuery.questions as any,
			answers:
				originalQuery.questions
					?.map((q) => ({
						name: q.name,
						type: q.type as any,
						class: q.class || 'IN',
						ttl: BLOCKED_RESPONSE_TTL,
						data: this.getBlockedAddressForType(q.type),
					}))
					.filter((a) => a.data !== null) || [],
		};

		return dnsPacket.encode(response as any);
	}

	/**
	 * Get the appropriate blocked address for a DNS record type
	 */
	private static getBlockedAddressForType(recordType: string): string | null {
		switch (recordType) {
			case DNS_RECORD_TYPES.A:
				return BLOCKED_IPV4_ADDRESS;
			case DNS_RECORD_TYPES.AAAA:
				return BLOCKED_IPV6_ADDRESS;
			default:
				return null; // Don't block other record types
		}
	}

	/**
	 * Create a Response object for blocked queries
	 */
	static createBlockedHttpResponse(responseBuffer: Buffer): Response {
		return new Response(responseBuffer, {
			status: 200,
			headers: {
				'Content-Type': DNS_MESSAGE_CONTENT_TYPE,
				'Cache-Control': BLOCKED_RESPONSE_CACHE_CONTROL,
			},
		});
	}

	/**
	 * Create a Response object from upstream DNS response
	 */
	static createUpstreamHttpResponse(responseBuffer: ArrayBuffer, upstreamResponse: Response): Response {
		return new Response(responseBuffer, {
			status: upstreamResponse.status,
			headers: upstreamResponse.headers,
		});
	}

	/**
	 * Create an error response for invalid DNS packets
	 */
	static createErrorResponse(message: string, status: number = 400): Response {
		return new Response(message, { status });
	}
}
