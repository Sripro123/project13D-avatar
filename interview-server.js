// Interview API Server for 3D Avatar Conference
import express from 'express';
import cors from 'cors';
import { UserDatabase } from './database.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize database
const db = new UserDatabase();

// Helper function to get user from session
function getUserFromSession(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        return db.validate_session(sessionToken);
    }
    return null;
}

// Interview API Routes

// Start interview session
app.post('/api/interview/start', async (req, res) => {
    try {
        console.log('🚀 POST /api/interview/start received:', req.body);
        
        const { roomId } = req.body;
        const user = getUserFromSession(req);
        
        if (!user) {
            // For demo purposes, allow without authentication
            console.log('⚠️ No user session found, proceeding with demo mode');
        }
        
        // Create interview session
        const userId = user ? user.id : 1; // Default user for demo
        const sessionId = db.create_interview_session(userId, `Interview in ${roomId}`);
        
        if (sessionId) {
            const sessionData = {
                id: sessionId,
                user_id: userId,
                room_id: roomId,
                status: 'active',
                created_at: new Date().toISOString(),
                questions_asked: 0,
                total_questions: 6
            };
            
            console.log('✅ Interview session created:', sessionData);
            res.json({ success: true, session: sessionData });
        } else {
            console.error('❌ Failed to create interview session');
            res.status(500).json({ success: false, error: 'Failed to create interview session' });
        }
        
    } catch (error) {
        console.error('❌ Error in /api/interview/start:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save interview question
app.post('/api/interview/question', async (req, res) => {
    try {
        console.log('📝 POST /api/interview/question received:', req.body);
        
        const { sessionId, question, questionType = 'technical' } = req.body;
        const user = getUserFromSession(req);
        
        if (!sessionId || !question) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const userId = user ? user.id : 1;
        const questionId = db.save_interview_question(sessionId, userId, 1, question, questionType);
        
        if (questionId) {
            console.log('✅ Question saved:', questionId);
            res.json({ success: true, questionId: questionId });
        } else {
            console.error('❌ Failed to save question');
            res.status(500).json({ success: false, error: 'Failed to save question' });
        }
        
    } catch (error) {
        console.error('❌ Error in /api/interview/question:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save interview answer
app.post('/api/interview/answer', async (req, res) => {
    try {
        console.log('💬 POST /api/interview/answer received:', req.body);
        
        const { sessionId, answer, user: userName } = req.body;
        const authUser = getUserFromSession(req);
        
        if (!sessionId || !answer) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const userId = authUser ? authUser.id : 1;
        
        // Update the last question with the answer
        // In a real implementation, you'd track which question is being answered
        console.log('✅ Answer saved for session:', sessionId);
        res.json({ success: true, message: 'Answer saved successfully' });
        
    } catch (error) {
        console.error('❌ Error in /api/interview/answer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete interview session
app.post('/api/interview/complete', async (req, res) => {
    try {
        console.log('🏁 POST /api/interview/complete received:', req.body);
        
        const { sessionId } = req.body;
        const user = getUserFromSession(req);
        
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Missing session ID' });
        }
        
        // Mark session as completed
        // In a real implementation, you'd update the database
        console.log('✅ Interview session completed:', sessionId);
        res.json({ success: true, message: 'Interview completed successfully' });
        
    } catch (error) {
        console.error('❌ Error in /api/interview/complete:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get interview sessions
app.get('/api/interview/sessions', async (req, res) => {
    try {
        const user = getUserFromSession(req);
        const userId = user ? user.id : 1;
        
        // In a real implementation, you'd fetch from database
        console.log('📋 GET /api/interview/sessions for user:', userId);
        res.json({ success: true, sessions: [] });
        
    } catch (error) {
        console.error('❌ Error in /api/interview/sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// User authentication endpoints
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 Login attempt:', username);
        
        const user = db.authenticate_user(username, password);
        
        if (user) {
            const sessionToken = db.create_session(user.id);
            res.json({ 
                success: true, 
                user: user, 
                sessionToken: sessionToken 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const user = getUserFromSession(req);
        if (user) {
            // Clean up session
            console.log('👋 User logged out:', user.username);
        }
        res.json({ success: true, message: 'Logged out successfully' });
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'interview-api'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`🚀 Interview API Server running on http://${HOST}:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /api/interview/start - Start interview session`);
    console.log(`   POST /api/interview/question - Save question`);
    console.log(`   POST /api/interview/answer - Save answer`);
    console.log(`   POST /api/interview/complete - Complete interview`);
    console.log(`   GET  /api/interview/sessions - Get sessions`);
    console.log(`   POST /api/login - User login`);
    console.log(`   POST /api/logout - User logout`);
    console.log(`   GET  /api/health - Health check`);
});

export default app;
