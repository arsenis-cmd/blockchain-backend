#!/usr/bin/env node

/**
 * Ziwio Blockchain Node Server - UPDATED FOR MOBILE APP SYNC
 * Production-ready bootstrap/seed node with mobile app support
 * Compatible with iOS app's LiteClientSyncManager
 */

const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 8333;
const WS_PORT = process.env.WS_PORT || PORT; // Use same port for WebSocket
const NODE_ENV = process.env.NODE_ENV || 'production';
const NODE_REGION = process.env.NODE_REGION || 'us-east-1';
const BLOCKCHAIN_DATA_DIR = process.env.BLOCKCHAIN_DATA_DIR || './blockchain_data';
const SAVE_INTERVAL = 60000; // Save every 60 seconds

// Node state
const peers = new Map(); // Connected peers
const blockchain = {
    blocks: new Map(),        // hash -> block
    transactions: new Map(),  // tx.id -> transaction
    height: 0,
    tips: new Set(),
    // NEW: Transaction indexing by address
    txByAddress: new Map(),   // address -> [tx.id]
    genesisHash: null
};

// Express app for HTTP endpoints
const app = express();
app.use(express.json());

// MARK: - Initialization

// Load blockchain from disk or create genesis
console.log('🔄 Initializing blockchain...');
const loaded = loadBlockchain();
if (!loaded) {
    createGenesisBlock();
}
console.log('');

// MARK: - WebSocket Server (Combined HTTP + WS)

const server = app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Ziwio Blockchain Node Started');
    console.log('=================================');
    console.log(`Server:      http://localhost:${PORT}`);
    console.log(`WebSocket:   ws://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Region:      ${NODE_REGION}`);
    console.log(`Data:        ${BLOCKCHAIN_DATA_DIR}`);
    console.log('=================================');
    console.log(`📊 Current State:`);
    console.log(`   Blocks: ${blockchain.blocks.size}`);
    console.log(`   Height: ${blockchain.height}`);
    console.log(`   Transactions: ${blockchain.transactions.size}`);
    console.log('=================================\n');
});

const wss = new WebSocket.Server({ server }); // Attach to same server

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
        // Mobile app uses P2PMessage format with id, type, senderId, payload, timestamp
        const { id, type, senderId, payload, timestamp } = message;

        // Register peer on first message
        if (!peer && senderId) {
            peer = new Peer(ws, senderId, clientIp);
            peers.set(senderId, peer);
            console.log(`✅ Peer registered: ${senderId} from ${clientIp}`);
        }

        if (peer) {
            peer.updateLastSeen();
        }

        // Route message
        switch (type) {
            case 'handshake':
                handleHandshake(message, ws);
                break;

            case 'syncRequest':
            case 'sync_request':
                handleSyncRequest(message, ws);
                break;

            case 'blockBroadcast':
            case 'block_broadcast':
                handleBlockBroadcast(message);
                break;

            case 'transactionBroadcast':
            case 'transaction_broadcast':
                handleTransactionBroadcast(message);
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

function handleHandshake(message, ws) {
    console.log(`👋 Handshake from ${message.senderId}`);

    const response = {
        id: generateMessageId(),
        type: 'handshake',
        senderId: 'seed_node',
        payload: Buffer.from(JSON.stringify({
            nodeId: 'seed_node',
            currentHeight: blockchain.height,
            timestamp: Date.now()
        })).toString('base64'),
        timestamp: Date.now() / 1000
    };

    ws.send(JSON.stringify(response));
}

function handleSyncRequest(message, ws) {
    try {
        // Decode base64 payload (mobile app format)
        const payloadStr = Buffer.from(message.payload, 'base64').toString('utf8');
        const syncRequest = JSON.parse(payloadStr);

        console.log(`🔄 Sync request from ${message.senderId}`);
        console.log(`   Last known height: ${syncRequest.lastKnownBlockHeight}`);
        console.log(`   User address: ${syncRequest.userAddress}`);
        console.log(`   Requested blocks: ${syncRequest.requestedBlocks || 100}`);

        // Get blocks after requested height
        const blocks = Array.from(blockchain.blocks.values())
            .filter(b => (b.header?.height || 0) > (syncRequest.lastKnownBlockHeight || 0))
            .sort((a, b) => (a.header?.height || 0) - (b.header?.height || 0))
            .slice(0, syncRequest.requestedBlocks || 100);

        // Get user's transactions
        const userTxIds = blockchain.txByAddress.get(syncRequest.userAddress) || [];
        const userTransactions = userTxIds
            .map(txId => blockchain.transactions.get(txId))
            .filter(tx => tx != null);

        // Calculate user balance
        const balance = calculateBalance(syncRequest.userAddress);

        // Build sync response (mobile app format)
        const syncResponse = {
            blocks: blocks,
            userTransactions: userTransactions,
            currentHeight: blockchain.height,
            currentBalances: {
                [syncRequest.userAddress]: balance
            }
        };

        // Encode response as P2PMessage
        const response = {
            id: message.id || generateMessageId(),
            type: 'syncResponse',
            senderId: 'seed_node',
            payload: Buffer.from(JSON.stringify(syncResponse)).toString('base64'),
            timestamp: Date.now() / 1000
        };

        ws.send(JSON.stringify(response));

        console.log(`✅ Sync response sent: ${blocks.length} blocks, ${userTransactions.length} user txs`);

    } catch (error) {
        console.error('❌ Sync request failed:', error);
    }
}

function handleBlockBroadcast(message) {
    try {
        // Decode payload
        const payloadStr = Buffer.from(message.payload, 'base64').toString('utf8');
        const block = JSON.parse(payloadStr);

        // Check if we already have this block
        if (blockchain.blocks.has(block.hash)) {
            return;
        }

        // Store block and its transactions
        blockchain.blocks.set(block.hash, block);
        blockchain.height = Math.max(blockchain.height, block.header?.height || 0);

        // Index transactions
        if (block.transactions) {
            block.transactions.forEach(tx => {
                storeTransaction(tx);
            });
        }

        console.log(`📦 New block: height ${block.header?.height}, hash ${block.hash?.substring(0, 8)}`);

        // Broadcast to other peers
        broadcastToPeers(message, message.senderId);

    } catch (error) {
        console.error('❌ Block broadcast failed:', error);
    }
}

function handleTransactionBroadcast(message) {
    try {
        // Decode payload
        const payloadStr = Buffer.from(message.payload, 'base64').toString('utf8');
        const transaction = JSON.parse(payloadStr);

        // Store transaction
        storeTransaction(transaction);

        console.log(`💸 New transaction: ${transaction.id}, type: ${transaction.type}`);

        // Broadcast to other peers
        broadcastToPeers(message, message.senderId);

    } catch (error) {
        console.error('❌ Transaction broadcast failed:', error);
    }
}

function handleHeartbeat(message, ws) {
    const response = {
        id: generateMessageId(),
        type: 'heartbeat',
        senderId: 'seed_node',
        payload: Buffer.from(JSON.stringify({
            timestamp: Date.now(),
            height: blockchain.height,
            peerCount: peers.size
        })).toString('base64'),
        timestamp: Date.now() / 1000
    };

    ws.send(JSON.stringify(response));
}

// MARK: - Blockchain Helpers

function storeTransaction(tx) {
    if (!tx || !tx.id) return;

    // Store transaction
    blockchain.transactions.set(tx.id, tx);

    // Index by address
    if (tx.fromAddress) {
        if (!blockchain.txByAddress.has(tx.fromAddress)) {
            blockchain.txByAddress.set(tx.fromAddress, []);
        }
        blockchain.txByAddress.get(tx.fromAddress).push(tx.id);
    }

    if (tx.toAddress && tx.toAddress !== tx.fromAddress) {
        if (!blockchain.txByAddress.has(tx.toAddress)) {
            blockchain.txByAddress.set(tx.toAddress, []);
        }
        blockchain.txByAddress.get(tx.toAddress).push(tx.id);
    }
}

function calculateBalance(address) {
    const txIds = blockchain.txByAddress.get(address) || [];
    let balance = 0;

    txIds.forEach(txId => {
        const tx = blockchain.transactions.get(txId);
        if (!tx) return;

        // Add received amounts
        if (tx.toAddress === address) {
            balance += (tx.amount || 0);
        }

        // Subtract sent amounts and fees
        if (tx.fromAddress === address) {
            balance -= (tx.amount || 0);
            balance -= (tx.fee || 0);
        }
    });

    return balance;
}

function broadcastToPeers(message, excludeNodeId = null) {
    let sentCount = 0;

    peers.forEach((peer, nodeId) => {
        if (nodeId !== excludeNodeId && peer.ws.readyState === WebSocket.OPEN) {
            peer.send(message);
            sentCount++;
        }
    });

    return sentCount;
}

function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// MARK: - Blockchain Persistence

function ensureDataDirectory() {
    if (!fs.existsSync(BLOCKCHAIN_DATA_DIR)) {
        fs.mkdirSync(BLOCKCHAIN_DATA_DIR, { recursive: true });
        console.log(`📁 Created blockchain data directory: ${BLOCKCHAIN_DATA_DIR}`);
    }
}

function saveBlockchain() {
    try {
        ensureDataDirectory();

        const data = {
            blocks: Array.from(blockchain.blocks.entries()),
            transactions: Array.from(blockchain.transactions.entries()),
            txByAddress: Array.from(blockchain.txByAddress.entries()),
            height: blockchain.height,
            tips: Array.from(blockchain.tips),
            genesisHash: blockchain.genesisHash,
            savedAt: Date.now()
        };

        const filePath = path.join(BLOCKCHAIN_DATA_DIR, 'blockchain.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`💾 Blockchain saved: ${blockchain.blocks.size} blocks, ${blockchain.transactions.size} txs`);
    } catch (error) {
        console.error('❌ Failed to save blockchain:', error);
    }
}

function loadBlockchain() {
    try {
        const filePath = path.join(BLOCKCHAIN_DATA_DIR, 'blockchain.json');

        if (!fs.existsSync(filePath)) {
            console.log('📭 No saved blockchain found, will create genesis block');
            return false;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        blockchain.blocks = new Map(data.blocks);
        blockchain.transactions = new Map(data.transactions);
        blockchain.txByAddress = new Map(data.txByAddress);
        blockchain.height = data.height;
        blockchain.tips = new Set(data.tips);
        blockchain.genesisHash = data.genesisHash;

        console.log('📂 Blockchain loaded from disk:');
        console.log(`   - Blocks: ${blockchain.blocks.size}`);
        console.log(`   - Transactions: ${blockchain.transactions.size}`);
        console.log(`   - Height: ${blockchain.height}`);
        console.log(`   - Saved: ${new Date(data.savedAt).toISOString()}`);

        return true;
    } catch (error) {
        console.error('❌ Failed to load blockchain:', error);
        return false;
    }
}

function createGenesisBlock() {
    console.log('⛏️  Creating genesis block...');

    const genesisTimestamp = Date.now();
    const genesisTransactions = [];

    // Initial token distribution
    const initialSupply = {
        'treasury': 100000000,      // 100M ZWO for treasury
        'team': 20000000,            // 20M ZWO for team
        'validators': 10000000,      // 10M ZWO for validators
        'community_rewards': 30000000, // 30M ZWO for rewards
        'liquidity_pool': 40000000   // 40M ZWO for liquidity
    };

    // Create genesis transactions
    Object.entries(initialSupply).forEach(([address, amount], index) => {
        const tx = {
            id: `genesis-tx-${index}`,
            type: 'genesis_allocation',
            fromAddress: 'genesis',
            toAddress: address,
            amount: amount,
            fee: 0,
            timestamp: genesisTimestamp,
            data: {
                allocation_type: address,
                total_supply: 200000000 // 200M total
            }
        };

        genesisTransactions.push(tx);
        storeTransaction(tx);
    });

    // Create genesis block
    const genesisBlock = {
        hash: crypto.createHash('sha256')
            .update('ziwio-genesis-block' + genesisTimestamp)
            .digest('hex'),
        header: {
            height: 0,
            index: 0,
            timestamp: genesisTimestamp / 1000,
            previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
            merkleRoot: crypto.createHash('sha256')
                .update(JSON.stringify(genesisTransactions))
                .digest('hex')
        },
        transactions: genesisTransactions,
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    blockchain.blocks.set(genesisBlock.hash, genesisBlock);
    blockchain.height = 0;
    blockchain.tips.add(genesisBlock.hash);
    blockchain.genesisHash = genesisBlock.hash;

    console.log('✅ Genesis block created:');
    console.log(`   - Hash: ${genesisBlock.hash.substring(0, 16)}...`);
    console.log(`   - Transactions: ${genesisTransactions.length}`);
    console.log(`   - Total Supply: 200,000,000 ZWO`);

    // Save immediately
    saveBlockchain();
}

// Auto-save blockchain periodically
setInterval(() => {
    if (blockchain.blocks.size > 0) {
        saveBlockchain();
    }
}, SAVE_INTERVAL);

// MARK: - HTTP Endpoints

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        peers: peers.size,
        blockHeight: blockchain.height,
        totalBlocks: blockchain.blocks.size,
        totalTransactions: blockchain.transactions.size,
        region: NODE_REGION,
        version: '2.0.0'
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

app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const blocks = Array.from(blockchain.blocks.values())
        .sort((a, b) => (b.header?.height || 0) - (a.header?.height || 0))
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

app.get('/transactions', (req, res) => {
    const address = req.query.address;
    const limit = parseInt(req.query.limit) || 50;

    let transactions;

    if (address) {
        const txIds = blockchain.txByAddress.get(address) || [];
        transactions = txIds
            .map(id => blockchain.transactions.get(id))
            .filter(tx => tx != null)
            .slice(0, limit);
    } else {
        transactions = Array.from(blockchain.transactions.values()).slice(0, limit);
    }

    res.json({
        count: transactions.length,
        transactions: transactions
    });
});

app.get('/balance/:address', (req, res) => {
    const balance = calculateBalance(req.params.address);

    res.json({
        address: req.params.address,
        balance: balance
    });
});

// MARK: - Peer Maintenance

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
}, 30000);

// Stats logging every 5 minutes
setInterval(() => {
    console.log(`📊 Stats: ${peers.size} peers, ${blockchain.blocks.size} blocks, ${blockchain.transactions.size} txs, height ${blockchain.height}`);
}, 300000);

// MARK: - Graceful Shutdown

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, closing server...');

    // Save blockchain before shutting down
    saveBlockchain();

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

    // Save blockchain before shutting down
    saveBlockchain();

    process.exit(0);
});
