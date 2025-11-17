# 🛡️ DoH Proxy with Pi-hole Blocking

NOTE: While I have been using it personally for a while, it is still unreliable and still seemingly fails at random times. Do not use this as your main DNS resolver for now

A high-performance DNS-over-HTTPS proxy built for Cloudflare Workers with integrated Pi-hole blocklist filtering.

## TODO

- Add a webinterface / api for adding custom blocklists globally
- Add the ability to redirect existing hostnames to custom IPs
  Use D1 to get custom DNS queries in constructor or similar
  Store them in the Durable Object SQL for faster access

## ✨ Features

- **DNS-over-HTTPS Proxy**: Forwards DNS queries to Cloudflare's secure DNS
- **Pi-hole Blocking**: Blocks ads, trackers, and malware domains (~247k domains)
- **Build-time Optimization**: Blocklist compiled at build time for instant startup
- **Multiple Formats**: Supports both DNS wire format and JSON queries
- **Comprehensive Logging**: Detailed DNS query and response logging

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Deploy to Cloudflare Workers
pnpm deploy
```

## 📁 Project Structure

```
src/
├── types/           # TypeScript interfaces
├── utils/           # Utilities for blocking, logging etc
├── durable-objects/ # The durable object used for DNS queries
├── db/ # Drizzle database schemas etc
└── index.ts         # Main application
plugins/
└── blocklist-compiler.ts  # Build-time blocklist optimization
```

## ⚡ Performance

- **Zero Runtime Parsing**: Pi-hole blocklist compiled at build time
- **O(1) Domain Lookups**: Lightning fast database lookup with Set.has() backup
- **Fast Cold Starts**: No initialization overhead
- **Subdomain Blocking**: Automatically blocks subdomains of listed domains

## 🔧 Configuration

The blocklist compiler can be configured in `vite.config.ts`:

```typescript
blocklistCompiler({
	blocklistPath: 'lists/pi-hole.txt', // Path to hosts file
	logStats: true, // Show compilation stats
});
```

## 📊 DNS Endpoints

### Wire Format (Binary)

```
GET  /?dns=<base64url-encoded-query>
POST / (Content-Type: application/dns-message)
```

### JSON Format

```
GET /?name=example.com&type=A
```

## 🛠️ Development

- **TypeScript**: Full type safety with strict mode
- **Modular Architecture**: Clear separation of concerns
- **Build-time Validation**: Catch blocklist issues during development
- **Comprehensive Logging**: Structured logging throughout

## 📝 License

MIT
