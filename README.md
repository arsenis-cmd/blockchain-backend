# Ziwio Blockchain Node

Production-ready blockchain seed node for peer discovery and block relay.

## 🚀 Quick Start

### Local Development
```bash
npm install
npm start
```

Server runs on:
- HTTP API: http://localhost:8333
- WebSocket: ws://localhost:8334

### Deploy to Cloud
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Recommended:** Deploy to Railway.app (free, 2 minutes setup)

## 📡 API Endpoints

- `GET /health` - Health check and server stats
- `GET /peers` - List of connected peers
- `GET /nodes` - All known nodes
- `GET /blocks` - Recent blockchain blocks
- `GET /block/:hash` - Get specific block by hash
- `POST /broadcast` - Broadcast message to all peers

## 🔌 WebSocket Events

**Client → Server:**
- `peer_discovery` - Request peer list
- `block_proposal` - Submit new block
- `sync_request` - Request blockchain sync
- `heartbeat` - Keep connection alive

**Server → Client:**
- `peer_list` - List of available peers
- `block_proposal` - New block broadcast
- `sync_response` - Blockchain data
- `heartbeat_response` - Heartbeat acknowledgment

## 🛠️ Environment Variables

- `PORT` - HTTP server port (default: 8333)
- `WS_PORT` - WebSocket port (default: 8334)
- `NODE_ENV` - Environment (production/development)
- `NODE_REGION` - Server region (e.g., us-east-1)

## 📊 Monitoring

Check server health:
```bash
curl http://localhost:8333/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "peers": 5,
  "knownNodes": 12,
  "blockHeight": 1234,
  "region": "us-east-1",
  "version": "1.0.0"
}
```

## 🔧 Maintenance

The server automatically:
- Pings peers every 30 seconds (removes dead connections)
- Cleans stale nodes every 24 hours
- Logs statistics every 5 minutes

## 📱 iOS Integration

Connect from your Swift app:
```swift
let serverURL = "https://your-deployed-url.com"
let websocketURL = "wss://your-deployed-url.com"
```

## 🐛 Troubleshooting

**Server won't start:**
- Check if ports 8333/8334 are available
- Verify Node.js version >= 18.0.0
- Run `npm install` to install dependencies

**No peers connecting:**
- Check firewall allows incoming connections
- Verify WebSocket port is accessible
- Check server logs for errors

## 📝 License

MIT
