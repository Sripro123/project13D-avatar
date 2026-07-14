// HTTPS WebRTC Signaling Server for 3D Avatar Conference
import WebSocket, { WebSocketServer } from 'ws';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8443;
const WS_PORT = process.env.WS_PORT || 8444;

// Conference state
const rooms = new Map();
const clients = new Map();
const deviceHeartbeats = new Map(); // Track device heartbeats for multi-device support

// SSL Certificate options (using self-signed certificate for development)
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// HTTPS Server for serving files
const server = https.createServer(sslOptions, (req, res) => {
    // Parse URL to handle query parameters correctly
    const parsedUrl = new URL(req.url, `https://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // Default to login.html instead of conference.html
    const filePath = path.join(__dirname, pathname === '/' ? 'login.html' : pathname.substring(1));
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

    // Parse body for API requests
    if (req.method === 'POST') {
        console.log(`[SERVER] POST Request: ${req.url}`);
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log(`[SERVER] Body received for ${req.url}. Length: ${body.length}`);

            // Auth Routes
            if (req.url === '/api/login') { handleLogin(req, res, body); return; }
            if (req.url === '/api/register') { handleRegister(req, res, body); return; }

            // Interview Routes
            if (req.url === '/api/interview/start') { handleInterviewStart(req, res, body); return; }
            if (req.url === '/api/interview/question') { handleInterviewQuestion(req, res, body); return; }
            if (req.url === '/api/interview/answer') { handleInterviewAnswer(req, res, body); return; }
            if (req.url === '/api/interview/poll') { handleInterviewPoll(req, res, body); return; }
            if (req.url === '/api/interview/poll') { handleInterviewPoll(req, res, body); return; }
            if (req.url === '/api/interview/complete') { handleInterviewComplete(req, res, body); return; }

            // Profile Update Route
            if (req.url === '/api/update-profile') { handleUpdateProfile(req, res, body); return; }

            // Logout Route
            if (req.url === '/api/logout') { handleLogout(req, res); return; }
        });
        return; // Handled async
    }

    // Checking for GET API endpoints
    if (req.url === '/api/user-info' || req.url === '/api/check-auth') {
        handleUserInfo(req, res);
        return;
    }

    // Static file serving
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // Suppress log spam for browser internal metadata (.well-known, favicon)
                if (!filePath.includes('.well-known') && !pathname.includes('favicon.ico')) {
                    console.error(`[SERVER] 404 - Not Found: ${pathname}`);
                }
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// User Storage
const USERS_FILE = path.join(__dirname, 'users.json');
const INTERVIEWS_FILE = path.join(__dirname, 'interviews.json');
let users = [];
let interviews = [];

// Load users
if (fs.existsSync(USERS_FILE)) {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
        console.log(`Loaded ${users.length} users`);
    } catch (e) {
        console.error('Failed to load users:', e);
    }
} else {
    users.push({
        id: 'user-default',
        username: 'admin',
        password: 'password123',
        full_name: 'Admin User',
        email: 'admin@example.com'
    });
    saveUsers();
}

// Load interviews
if (fs.existsSync(INTERVIEWS_FILE)) {
    try {
        const data = fs.readFileSync(INTERVIEWS_FILE, 'utf8');
        interviews = JSON.parse(data);
        console.log(`Loaded ${interviews.length} interview sessions`);
    } catch (e) {
        console.error('Failed to load interviews:', e);
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveInterviews() {
    fs.writeFileSync(INTERVIEWS_FILE, JSON.stringify(interviews, null, 2));
}

// Active Interview Sessions (In-Memory State for Realtime Sync)
const activeSessions = new Map(); // roomId -> { sessionId, currentQuestion, answers: [] }

// Handle Login
// Handle Login
function handleLogin(req, res, body) {
    try {
        const { username, password } = JSON.parse(body);
        console.log(`\n--- Login Attempt ---`);
        console.log(`Input Username: '${username}'`);
        console.log(`Input Password: '${password}'`);

        const user = users.find(u => {
            const usernameMatch = (u.username === username.trim()) || (u.email === username.trim());
            const passwordMatch = u.password === password;

            if (usernameMatch) {
                console.log(`Found user '${u.username}'. verification:`);
                console.log(`   Stored Password: '${u.password}'`);
                console.log(`   Input Password : '${password}'`);
                console.log(`   Match? ${passwordMatch}`);
                console.log(`   Length check: Stored(${u.password.length}) vs Input(${password.length})`);
            }
            return usernameMatch && passwordMatch;
        });

        if (user) {
            console.log('Login successful for:', user.username);

            // Set simple session cookie
            res.setHeader('Set-Cookie', `session=${user.id}; Path=/; HttpOnly; SameSite=Strict`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name
                }
            }));
        } else {
            console.log('Login failed: Invalid credentials');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
        }
    } catch (e) {
        console.error('Login error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
    }
}

// Handle Logout
function handleLogout(req, res) {
    console.log('[SERVER] Logging out user');
    // Clear cookie by setting expiry to past date
    res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
}

// Handle Register
function handleRegister(req, res, body) {
    try {
        const data = JSON.parse(body);
        const { username, password, email, fullName } = data;

        if (users.find(u => u.username === username || u.email === email)) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User already exists' }));
            return;
        }

        const newUser = {
            id: 'user-' + Date.now(),
            username,
            password, // HASH THIS in production
            email,
            full_name: fullName || username,
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers();

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'User registered successfully' }));
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
    }
}

// --- INTERVIEW HANDLERS ---

function handleInterviewStart(req, res, body) {
    console.log("[SERVER] handleInterviewStart called");
    try {
        const { roomId } = JSON.parse(body); // Optional: Link to room
        const sessionId = 'session-' + Date.now();

        const newSession = {
            id: sessionId,
            roomId: roomId || 'lobby',
            started_at: new Date().toISOString(),
            status: 'active',
            current_question: 0,
            answers: [] // { question_number: 1, text: "...", user: "..." }
        };

        interviews.push(newSession);
        // Also update active session map for faster lookup if needed, 
        // but for now we just use the array or a global reference for the room
        activeSessions.set(roomId || 'lobby', newSession);

        saveInterviews();

        // Broadcast to Room via WebSocket
        const startMessage = {
            type: 'interview-started',
            session: newSession
        };
        broadcastToRoom(roomId || 'lobby', startMessage);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session: newSession }));
    } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ success: false }));
    }
}


function handleInterviewQuestion(req, res, body) {
    try {
        const { session_id, question_number, question } = JSON.parse(body);
        const session = interviews.find(s => s.id === session_id);

        if (!session) {
            res.writeHead(404); res.end(JSON.stringify({ success: false, message: "Session not found" }));
            return;
        }

        // Initialize questions array if missing
        if (!session.questions) {
            session.questions = [];
        }

        const questionId = 'q-' + Date.now();
        session.questions.push({
            id: questionId,
            number: question_number,
            text: question,
            timestamp: new Date().toISOString()
        });

        // Update persistence
        saveInterviews();

        // Update active session cache
        if (activeSessions.has(session.roomId)) {
            activeSessions.set(session.roomId, session);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, question_id: questionId }));

    } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ success: false }));
    }
}

function handleInterviewAnswer(req, res, body) {
    try {
        const { sessionId, answer, user } = JSON.parse(body);
        const session = interviews.find(s => s.id === sessionId);

        if (!session) {
            res.writeHead(404); res.end(JSON.stringify({ success: false, message: "Session not found" }));
            return;
        }

        // Store Answer
        session.current_question++;
        session.answers.push({
            question_number: session.current_question,
            answer_text: answer,
            user: user || 'Anonymous',
            timestamp: new Date().toISOString()
        });

        // Update persistence
        saveInterviews();

        // Update active session cache
        if (activeSessions.has(session.roomId)) {
            activeSessions.set(session.roomId, session);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, next_question: session.current_question + 1 }));

    } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ success: false }));
    }
}

function handleInterviewPoll(req, res, body) {
    try {
        const { roomId } = JSON.parse(body);
        let session = activeSessions.get(roomId || 'lobby');

        // If no active session in memory, look for last active in DB
        if (!session) {
            session = interviews.slice().reverse().find(s => s.roomId === (roomId || 'lobby') && s.status === 'active');
            if (session) activeSessions.set(roomId || 'lobby', session);
        }

        if (session) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, session: session }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "No active session" }));
        }
    } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ success: false }));
    }
}

function handleInterviewComplete(req, res, body) {
    try {
        const { sessionId } = JSON.parse(body);
        const session = interviews.find(s => s.id === sessionId);

        if (session) {
            session.status = 'completed';
            session.completed_at = new Date().toISOString();
            saveInterviews();

            // Clear from active map
            activeSessions.delete(session.roomId);

            // Broadcast completion
            const endMessage = {
                type: 'interview-ended',
                sessionId: sessionId
            };
            broadcastToRoom(session.roomId, endMessage);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ success: false }));
    }
}

// Handle Update Profile
function handleUpdateProfile(req, res, body) {
    try {
        // Identify user from session cookie
        const cookie = req.headers.cookie || '';
        const match  = cookie.match(/session=([^;]+)/);
        const userId = match ? match[1] : null;

        if (!userId) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Not authenticated' }));
            return;
        }

        const user = users.find(u => u.id === userId);
        if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User not found' }));
            return;
        }

        const { full_name, username, email, avatar_url } = JSON.parse(body);

        // Validate required fields
        if (!full_name || !email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Full name and email are required' }));
            return;
        }

        // Check email uniqueness (ignore own record)
        const emailTaken = users.some(u => u.email === email.trim() && u.id !== userId);
        if (emailTaken) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Email already in use by another account' }));
            return;
        }

        // Check username uniqueness if provided
        if (username) {
            const usernameTaken = users.some(u => u.username === username.trim() && u.id !== userId);
            if (usernameTaken) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Username already taken' }));
                return;
            }
        }

        // Apply updates
        user.full_name = full_name.trim();
        user.email     = email.trim();
        if (username) user.username = username.trim();
        // Save avatar: accept base64 data-URL or explicit null (remove photo)
        if (avatar_url !== undefined) {
            user.avatar_url = avatar_url || null;
        }
        user.updated_at = new Date().toISOString();

        // Persist to users.json
        saveUsers();

        console.log(`[SERVER] Profile updated for user: ${user.username}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id:        user.id,
                username:  user.username,
                full_name: user.full_name,
                email:     user.email
            }
        }));
    } catch (e) {
        console.error('[SERVER] Update profile error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
    }
}

// Handle User Info / Check Auth
function handleUserInfo(req, res) {
    // Check for session cookie
    const cookie = req.headers.cookie;

    if (cookie && cookie.includes('session=')) {
        const match = cookie.match(/session=([^;]+)/);
        const userId = match ? match[1] : null;

        if (userId) {
            const user = users.find(u => u.id === userId);
            if (user) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    authenticated: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        email: user.email,
                        avatar_url: user.avatar_url || null
                    }
                }));
                return;
            }
        }
    }

    // Fallback if no cookie or user not found
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        authenticated: false,
        message: 'No active session'
    }));
}

// WebSocket Server for signaling
// Attach to the existing HTTPS server to enable WSS (Secure WebSockets)
// This will share port 8443
const wss = new WebSocketServer({ server });

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

                case 'ai-response':
                    await handleAIResponse(ws, data);
                    break;

                case 'device-heartbeat':
                    await handleDeviceHeartbeat(ws, data);
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
    const { roomId, userId, userName, avatarUrl } = data;

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
        room: roomId,
        avatarUrl: avatarUrl || null
    });

    // Notify room members
    const joinMessage = {
        type: 'user-joined',
        userId: userId,
        userName: userName,
        avatarUrl: avatarUrl || null,
        participants: Array.from(room).map(client => clients.get(client))
    };

    broadcastToRoom(roomId, joinMessage, ws);
    console.log(`${userName} joined room ${roomId} (Avatar: ${avatarUrl})`);

    // Notify the NEW user about existing participants
    // Filter out self from the list for clarity (optional, but good practice)
    const existingParticipants = Array.from(room)
        .filter(client => client !== ws)
        .map(client => clients.get(client));

    const welcomeMessage = {
        type: 'room-joined',
        roomId: roomId,
        userId: userId, // Confirming their own ID
        userName: userName,
        participants: existingParticipants
    };

    ws.send(JSON.stringify(welcomeMessage));
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

// Handle AI Response Synchronization
async function handleAIResponse(ws, data) {
    const { roomId, text, emotion } = data;
    const room = rooms.get(roomId);

    console.log(`🤖 AI Response in room ${roomId}: ${text.substring(0, 30)}...`);

    if (room) {
        const aiMessage = {
            type: 'ai-response',
            text: text,
            emotion: emotion || 'neutral'
        };

        broadcastToRoom(roomId, aiMessage, ws);
    }
}

// Handle Device Heartbeat for Multi-Device Support
async function handleDeviceHeartbeat(ws, data) {
    const { roomId, userId, deviceFingerprint, timestamp } = data;
    
    // Store heartbeat with device fingerprint
    deviceHeartbeats.set(userId, {
        deviceFingerprint,
        timestamp,
        lastSeen: Date.now()
    });

    // Log for debugging
    console.log(`💓 Heartbeat from ${userId} (${deviceFingerprint}) in room ${roomId}`);

    // Clean up old heartbeats (older than 2 minutes)
    const now = Date.now();
    for (const [uid, heartbeat] of deviceHeartbeats.entries()) {
        if (now - heartbeat.lastSeen > 120000) { // 2 minutes
            deviceHeartbeats.delete(uid);
            console.log(`🧹 Cleaned up old heartbeat for ${uid}`);
        }
    }

    // Optionally broadcast device count to room
    const room = rooms.get(roomId);
    if (room) {
        const activeDevices = new Set();
        for (const client of room) {
            const clientInfo = clients.get(client);
            if (clientInfo && deviceHeartbeats.has(clientInfo.id)) {
                activeDevices.add(deviceHeartbeats.get(clientInfo.id).deviceFingerprint);
            }
        }
        
        // If there are duplicate device fingerprints, notify room
        if (activeDevices.size < room.size) {
            console.log(`⚠️ Duplicate device detected in room ${roomId}`);
            const deviceWarning = {
                type: 'device-warning',
                message: 'Multiple devices from same network detected'
            };
            broadcastToRoom(roomId, deviceWarning);
        }
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

// Helper to get local IP
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

function getAllLocalIps() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {

            if (iface.family === 'IPv4') {
                console.log(`Adapter: ${name} -> ${iface.address}`);
            }

        }
    }
}
// Start servers
server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${PORT}`);

    console.log("Available Network Interfaces:");
    getAllLocalIps();
});

console.log(`WebSocket signaling server running on port ${PORT} (Integrated)`);

console.log('3D Avatar Conference Server Started (HTTPS)');
const localIp = getLocalIpAddress();

console.log('\n🌐 === SERVER ACCESS URLs ===');
console.log(`🔒 HTTPS: https://${localIp}:${PORT}`);
console.log(`🔗 WebSocket: wss://${localIp}:${PORT}`);
console.log(`🏠 Local: https://localhost:${PORT}`);

// Show all available network interfaces for easy access
console.log('\n📡 === ALL NETWORK INTERFACES ===');
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`📍 ${name}: https://${iface.address}:${PORT}`);
        }
    }
}

console.log('\n📝 NOTE: You may need to accept the self-signed certificate in your browser');
console.log('   Click "Advanced" then "Proceed to localhost (unsafe)" when prompted');
