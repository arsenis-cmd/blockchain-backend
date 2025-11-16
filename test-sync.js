/**
 * Test script for backend sync compatibility
 * Run this to verify your backend works with the mobile app
 */

const WebSocket = require('ws');

// Configuration
const SERVER_URL = process.argv[2] || 'ws://localhost:8333';
const TEST_ADDRESS = '0xTEST_ADDRESS_123456';

console.log('\n🧪 Testing Backend Sync Compatibility');
console.log('=====================================');
console.log(`Server: ${SERVER_URL}`);
console.log(`Test Address: ${TEST_ADDRESS}\n`);

const ws = new WebSocket(SERVER_URL);

let testsPassed = 0;
let testsFailed = 0;

ws.on('open', () => {
    console.log('✅ [1/3] WebSocket connection established\n');
    testsPassed++;

    // Wait for handshake
    setTimeout(() => {
        sendSyncRequest();
    }, 500);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);

        console.log(`📥 Received message type: ${message.type}`);

        if (message.type === 'handshake') {
            console.log('   ✅ Handshake received from backend');

            // Decode and log payload
            try {
                const payload = JSON.parse(Buffer.from(message.payload, 'base64').toString('utf8'));
                console.log(`   Node ID: ${payload.nodeId}`);
                console.log(`   Height: ${payload.currentHeight}\n`);
            } catch (e) {
                console.log('   ⚠️  Could not decode handshake payload\n');
            }
        }

        if (message.type === 'syncResponse') {
            console.log('✅ [2/3] Sync response received\n');
            testsPassed++;

            try {
                // Decode base64 payload
                const payload = JSON.parse(Buffer.from(message.payload, 'base64').toString('utf8'));

                // Check response format
                const hasBlocks = Array.isArray(payload.blocks);
                const hasUserTxs = Array.isArray(payload.userTransactions);
                const hasHeight = typeof payload.currentHeight === 'number';
                const hasBalances = typeof payload.currentBalances === 'object';

                console.log('📊 Response Format Check:');
                console.log(`   blocks: ${hasBlocks ? '✅' : '❌'} (${payload.blocks?.length || 0} blocks)`);
                console.log(`   userTransactions: ${hasUserTxs ? '✅' : '❌'} (${payload.userTransactions?.length || 0} txs)`);
                console.log(`   currentHeight: ${hasHeight ? '✅' : '❌'} (${payload.currentHeight})`);
                console.log(`   currentBalances: ${hasBalances ? '✅' : '❌'}\n`);

                if (hasBlocks && hasUserTxs && hasHeight && hasBalances) {
                    console.log('✅ [3/3] Response format is correct\n');
                    testsPassed++;

                    // Show balance
                    if (payload.currentBalances[TEST_ADDRESS] !== undefined) {
                        console.log(`💰 Balance for ${TEST_ADDRESS}:`);
                        console.log(`   ${payload.currentBalances[TEST_ADDRESS]} ZWO\n`);
                    }
                } else {
                    console.log('❌ [3/3] Response format is INCORRECT\n');
                    testsFailed++;
                }

                printResults();
                ws.close();
                process.exit(testsFailed > 0 ? 1 : 0);

            } catch (error) {
                console.error('❌ Failed to decode sync response:', error.message);
                testsFailed++;
                printResults();
                ws.close();
                process.exit(1);
            }
        }

    } catch (error) {
        console.error('❌ Failed to parse message:', error);
    }
});

ws.on('error', (error) => {
    console.error('\n❌ WebSocket error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure backend is running');
    console.log('   2. Check the server URL is correct');
    console.log('   3. Verify WebSocket port is accessible\n');
    process.exit(1);
});

ws.on('close', () => {
    console.log('🔌 Connection closed\n');
});

function sendSyncRequest() {
    console.log('📤 Sending sync request...\n');

    // Create sync request in mobile app format
    const syncRequest = {
        id: `test-${Date.now()}`,
        type: 'syncRequest',
        senderId: 'test-client',
        payload: Buffer.from(JSON.stringify({
            lastKnownBlockHash: null,
            lastKnownBlockHeight: 0,
            userAddress: TEST_ADDRESS,
            requestedBlocks: 100
        })).toString('base64'),
        timestamp: Date.now() / 1000
    };

    ws.send(JSON.stringify(syncRequest));
}

function printResults() {
    console.log('=====================================');
    console.log('📊 Test Results:');
    console.log(`   Passed: ${testsPassed}/3`);
    console.log(`   Failed: ${testsFailed}/3`);
    console.log('=====================================\n');

    if (testsFailed === 0) {
        console.log('🎉 All tests passed! Backend is compatible with mobile app.\n');
        console.log('✅ You can now deploy this backend to Render.com\n');
    } else {
        console.log('❌ Some tests failed. Backend needs updates.\n');
        console.log('💡 Make sure you deployed blockchain-node-UPDATED.js\n');
    }
}

// Timeout after 10 seconds
setTimeout(() => {
    console.error('\n⏱️  Test timeout - no response from server\n');
    console.log('💡 Troubleshooting:');
    console.log('   1. Backend might not be running');
    console.log('   2. Sync handler might not be implemented');
    console.log('   3. Check backend logs for errors\n');
    ws.close();
    process.exit(1);
}, 10000);
