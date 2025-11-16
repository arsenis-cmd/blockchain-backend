#!/usr/bin/env node

/**
 * Ziwio Blockchain Node Server
 * Production-ready bootstrap/seed node for peer discovery
 * Run this on cloud servers (AWS, DigitalOcean, etc.)
 */

const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const dns = require('dns').promises;

// Configuration
const PORT = process.env.PORT || 8333;
const WS_PORT = process.env.WS_PORT || 8334;
const NODE_ENV = process.env.NODE_ENV || 'production';
const NODE_REGION = process.env.NODE_REGION || 'us-east-1';

// Node state
const peers = new Map(); // Connected peers
const knownNodes = new Set(); // All discovered nodes
const blockchain = {
    blocks: new Map(),
    height: 0,
    tips: new Set()
};

// Express app for HTTP endpoints
const app = express();
app.use(express.json());

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ port: WS_PORT });

// MARK: - Peer Management

class Peer {
    constructor(ws, nodeId, address) {
        this.ws = ws;
        this.nodeId = nodeId;
        this.address = address;
        this.connectedAt = Date.now();
        this.lastSeen = Date.now();
        this.messageCount = 0;
        this.isAlive = true;
    }

    send(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            this.messageCount++;
        }
    }

    updateLastSeen() {
        this.lastSeen = Date.now();
    }
}

// MARK: - WebSocket Handlers

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`🔌 New connection from ${clientIp}`);

    let peer = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(message, ws, clientIp);
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
        }
    });

    ws.on('pong', () => {
        if (peer) {
            peer.isAlive = true;
            peer.updateLastSeen();
        }
    });

    ws.on('close', () => {
        if (peer) {
            console.log(`👋 Peer disconnected: ${peer.nodeId}`);
            peers.delete(peer.nodeId);
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });

    function handleMessage(message, ws, clientIp) {
        const { type, payload, sender } = message;

        // Register peer on first message
        if (!peer && sender) {
            peer = new Peer(ws, sender, clientIp);
            peers.set(sender, peer);
            knownNodes.add(`${clientIp}:${PORT}`);
            console.log(`✅ Peer registered: ${sender} from ${clientIp}`);
        }

        if (peer) {
            peer.updateLastSeen();
        }

        // Route message
        switch (type) {
            case 'peer_discovery':
                handlePeerDiscovery(message, ws);
                break;

            case 'block_proposal':
                handleBlockProposal(message);
                break;

            case 'sync_request':
                handleSyncRequest(message, ws);
                break;

            case 'heartbeat':
                handleHeartbeat(message, ws);
                break;

            default:
                console.log(`📨 Unknown message type: ${type}`);
        }
    }
});

// MARK: - Message Handlers

function handlePeerDiscovery(message, ws) {
    const { payload } = message;

    console.log(`🔍 Peer discovery request from ${payload.nodeId}`);

    // Send list of known peers
    const peerList = Array.from(peers.values())
        .filter(p => p.nodeId !== payload.nodeId)
        .map(p => ({
            host: p.address.replace('::ffff:', ''), // Remove IPv6 prefix
            port: PORT,
            nodeId: p.nodeId,
            version: '1.0.0',
            lastSeen: p.lastSeen
        }));

    const response = {
        type: 'peer_list',
        payload: {
            peers: peerList,
            responseTime: Date.now()
        },
        sender: 'seed_node'
    };

    ws.send(JSON.stringify(response));

    console.log(`📤 Sent ${peerList.length} peers to ${payload.nodeId}`);
}

function handleBlockProposal(message) {
    const { payload, sender } = message;

    try {
        const block = typeof payload === 'string' ? JSON.parse(payload) : payload;

        // Validate block
        if (!block.hash || !block.header) {
            console.error('❌ Invalid block structure');
            return;
        }

        // Check if we already have this block
        if (blockchain.blocks.has(block.hash)) {
            return;
        }

        // Store block
        blockchain.blocks.set(block.hash, block);
        blockchain.height = Math.max(blockchain.height, block.header.height || 0);

        console.log(`📦 New block: ${block.hash.substring(0, 8)} from ${sender}`);

        // Broadcast to other peers
        broadcastToPeers({
            type: 'block_proposal',
            payload: block,
            sender: 'seed_node'
        }, sender);

    } catch (error) {
        console.error('❌ Failed to process block:', error);
    }
}

function handleSyncRequest(message, ws) {
    const { payload } = message;

    console.log(`🔄 Sync request from ${payload.nodeId} at height ${payload.currentHeight}`);

    // Get blocks after requested height
    const blocks = Array.from(blockchain.blocks.values())
        .filter(b => (b.header.height || 0) > payload.currentHeight)
        .sort((a, b) => (a.header.height || 0) - (b.header.height || 0))
        .slice(0, payload.requestedBlocks || 100);

    const response = {
        type: 'sync_response',
        payload: blocks,
        sender: 'seed_node'
    };

    ws.send(JSON.stringify(response));

    console.log(`📤 Sent ${blocks.length} blocks to ${payload.nodeId}`);
}

function handleHeartbeat(message, ws) {
    // Respond to heartbeat
    ws.send(JSON.stringify({
        type: 'heartbeat_response',
        payload: {
            timestamp: Date.now(),
            peerCount: peers.size,
            blockHeight: blockchain.height
        },
        sender: 'seed_node'
    }));
}

// MARK: - Broadcasting

function broadcastToPeers(message, excludeNodeId = null) {
    let sentCount = 0;

    peers.forEach((peer, nodeId) => {
        if (nodeId !== excludeNodeId) {
            peer.send(message);
            sentCount++;
        }
    });

    return sentCount;
}

// MARK: - HTTP Endpoints

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        peers: peers.size,
        knownNodes: knownNodes.size,
        blockHeight: blockchain.height,
        region: NODE_REGION,
        version: '1.0.0'
    });
});

app.get('/peers', (req, res) => {
    const peerList = Array.from(peers.values()).map(p => ({
        nodeId: p.nodeId,
        address: p.address,
        connectedAt: p.connectedAt,
        lastSeen: p.lastSeen,
        messageCount: p.messageCount
    }));

    res.json({
        count: peerList.length,
        peers: peerList
    });
});

app.get('/nodes', (req, res) => {
    res.json({
        count: knownNodes.size,
        nodes: Array.from(knownNodes)
    });
});

app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const blocks = Array.from(blockchain.blocks.values())
        .sort((a, b) => (b.header.height || 0) - (a.header.height || 0))
        .slice(0, limit);

    res.json({
        height: blockchain.height,
        count: blocks.length,
        blocks: blocks
    });
});

app.get('/block/:hash', (req, res) => {
    const block = blockchain.blocks.get(req.params.hash);

    if (block) {
        res.json(block);
    } else {
        res.status(404).json({ error: 'Block not found' });
    }
});

app.post('/broadcast', (req, res) => {
    const { type, payload } = req.body;

    if (!type || !payload) {
        return res.status(400).json({ error: 'Missing type or payload' });
    }

    const sentCount = broadcastToPeers({
        type,
        payload,
        sender: 'api'
    });

    res.json({
        success: true,
        sentToPeers: sentCount
    });
});

// MARK: - Peer Maintenance

// Heartbeat check every 30 seconds
setInterval(() => {
    wss.clients.forEach((ws) => {
        const peer = Array.from(peers.values()).find(p => p.ws === ws);

        if (peer) {
            if (peer.isAlive === false) {
                console.log(`💔 Peer timeout: ${peer.nodeId}`);
                peers.delete(peer.nodeId);
                return ws.terminate();
            }

            peer.isAlive = false;
            ws.ping();
        }
    });

    // Clean up stale known nodes (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    peers.forEach((peer, nodeId) => {
        if (peer.lastSeen < oneDayAgo) {
            console.log(`🧹 Removing stale peer: ${nodeId}`);
            peers.delete(nodeId);
        }
    });
}, 30000);

// Stats logging every 5 minutes
setInterval(() => {
    console.log(`📊 Stats: ${peers.size} peers, ${blockchain.blocks.size} blocks, height ${blockchain.height}`);
}, 300000);

// MARK: - DNS Seed Support

app.get('/dns-seed', async (req, res) => {
    // Return list of known nodes for DNS seed
    const activeNodes = Array.from(peers.values())
        .filter(p => Date.now() - p.lastSeen < 3600000) // Active in last hour
        .map(p => p.address.replace('::ffff:', ''))
        .filter(addr => addr && !addr.startsWith('127.'));

    res.json({
        nodes: activeNodes,
        count: activeNodes.count
    });
});

// MARK: - Server Startup

app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Ziwio Blockchain Node Started');
    console.log('=================================');
    console.log(`HTTP API:    http://localhost:${PORT}`);
    console.log(`WebSocket:   ws://localhost:${WS_PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Region:      ${NODE_REGION}`);
    console.log('=================================');
    console.log('Endpoints:');
    console.log(`  GET  /health       - Health check`);
    console.log(`  GET  /peers        - Connected peers`);
    console.log(`  GET  /nodes        - Known nodes`);
    console.log(`  GET  /blocks       - Recent blocks`);
    console.log(`  GET  /block/:hash  - Get specific block`);
    console.log(`  POST /broadcast    - Broadcast message`);
    console.log('=================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, closing server...');

    wss.clients.forEach((ws) => {
        ws.close();
    });

    wss.close(() => {
        console.log('👋 WebSocket server closed');
    });

    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, closing server...');
    process.exit(0);
});
