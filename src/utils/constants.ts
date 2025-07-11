// DNS over HTTPS endpoints
export const DOH_ENDPOINT = 'https://security.cloudflare-dns.com/dns-query';
export const DOH_JSON_ENDPOINT = 'https://security.cloudflare-dns.com/dns-query';

// Content types
export const DNS_MESSAGE_CONTENT_TYPE = 'application/dns-message';
export const DNS_JSON_CONTENT_TYPE = 'application/dns-json';

// DNS response configuration
export const BLOCKED_RESPONSE_TTL = 300; // 5 minutes
export const BLOCKED_IPV4_ADDRESS = '0.0.0.0';
export const BLOCKED_IPV6_ADDRESS = '::';

// Cache control
export const BLOCKED_RESPONSE_CACHE_CONTROL = 'max-age=300';

// Localhost domains to skip during blocklist parsing
export const LOCALHOST_DOMAINS = ['localhost', 'localhost.localdomain', 'local', 'broadcasthost'] as const;

// DNS record types
export const DNS_RECORD_TYPES = {
	A: 'A',
	AAAA: 'AAAA',
	CNAME: 'CNAME',
	MX: 'MX',
	TXT: 'TXT',
} as const;
