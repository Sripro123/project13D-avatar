// WebRTC Signaling Server for 3D Avatar Conference
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const WS_PORT = process.env.WS_PORT || 8081;

// Conference state
const rooms = new Map();
const clients = new Map();

// HTTP Server for serving files
const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, req.url === '/' ? 'conference.html' : req.url.substring(1));
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.mjs':
            contentType = 'application/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.glb':
            contentType = 'model/gltf-binary';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(500);
            res.end('Server Error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// WebSocket Server for signaling
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join-room':
                    await handleJoinRoom(ws, data);
                    break;
                    
                case 'leave-room':
                    await handleLeaveRoom(ws, data);
                    break;
                    
                case 'offer':
                    await handleOffer(ws, data);
                    break;
                    
                case 'answer':
                    await handleAnswer(ws, data);
                    break;
                    
                case 'ice-candidate':
                    await handleIceCandidate(ws, data);
                    break;
                    
                case 'voice-activity':
                    await handleVoiceActivity(ws, data);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        removeClient(ws);
    });
});

// Handle room joining
async function handleJoinRoom(ws, data) {
    const { roomId, userId, userName } = data;
    
    // Add client to room
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    room.add(ws);
    
    // Store client info
    clients.set(ws, {
        id: userId,
        name: userName,
        room: roomId
    });
    
    // Notify room members
    const joinMessage = {
        type: 'user-joined',
        userId: userId,
        userName: userName,
        participants: Array.from(room).map(client => clients.get(client))
    };
    
    broadcastToRoom(roomId, joinMessage, ws);
    console.log(`${userName} joined room ${roomId}`);
}

// Handle WebRTC offer
async function handleOffer(ws, data) {
    const { roomId, targetUserId, offer } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        for (const client of room) {
            const clientInfo = clients.get(client);
            if (clientInfo && clientInfo.id === targetUserId) {
                client.send(JSON.stringify({
                    type: 'offer',
                    fromUserId: data.fromUserId,
                    offer: offer
                }));
                break;
            }
        }
    }
}

// Handle WebRTC answer
async function handleAnswer(ws, data) {
    const { roomId, targetUserId, answer } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        for (const client of room) {
            const clientInfo = clients.get(client);
            if (clientInfo && clientInfo.id === targetUserId) {
                client.send(JSON.stringify({
                    type: 'answer',
                    fromUserId: data.fromUserId,
                    answer: answer
                }));
                break;
            }
        }
    }
}

// Handle ICE candidates
async function handleIceCandidate(ws, data) {
    const { roomId, targetUserId, candidate } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        for (const client of room) {
            const clientInfo = clients.get(client);
            if (clientInfo && clientInfo.id === targetUserId) {
                client.send(JSON.stringify({
                    type: 'ice-candidate',
                    fromUserId: data.fromUserId,
                    candidate: candidate
                }));
                break;
            }
        }
    }
}

// Handle voice activity
async function handleVoiceActivity(ws, data) {
    const { roomId, userId, isSpeaking } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        const activityMessage = {
            type: 'voice-activity',
            userId: userId,
            isSpeaking: isSpeaking
        };
        
        broadcastToRoom(roomId, activityMessage, ws);
    }
}

// Remove client from room
function removeClient(ws) {
    const clientInfo = clients.get(ws);
    if (clientInfo && clientInfo.room) {
        const room = rooms.get(clientInfo.room);
        if (room) {
            room.delete(ws);
            
            // Notify others
            const leaveMessage = {
                type: 'user-left',
                userId: clientInfo.id,
                userName: clientInfo.name
            };
            
            broadcastToRoom(clientInfo.room, leaveMessage, ws);
        }
    }
    
    clients.delete(ws);
}

// Broadcast message to room
function broadcastToRoom(roomId, message, excludeWs = null) {
    const room = rooms.get(roomId);
    if (room) {
        for (const client of room) {
            if (client !== excludeWs) {
                client.send(JSON.stringify(message));
            }
        }
    }
}

// Start servers
server.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`Conference available at http://localhost:${PORT}/conference.html`);
});

console.log(`WebSocket signaling server running on port ${WS_PORT}`);

console.log('3D Avatar Conference Server Started');
console.log(`HTTP: http://localhost:${PORT}`);
console.log(`WebSocket: ws://localhost:${WS_PORT}`);
