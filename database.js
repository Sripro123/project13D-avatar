// JavaScript version of UserDatabase for Node.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import crypto from 'crypto';

export class UserDatabase {
    constructor(dbFile = "conference_users.db") {
        this.dbFile = dbFile;
        this.db = null;
    }

    async initDatabase() {
        this.db = await open({
            filename: this.dbFile,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                student_id TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            CREATE TABLE IF NOT EXISTS interview_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_name TEXT NOT NULL,
                role_type TEXT DEFAULT 'software_development',
                total_questions INTEGER DEFAULT 6,
                questions_asked INTEGER DEFAULT 0,
                session_status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            CREATE TABLE IF NOT EXISTS interview_qa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                question_number INTEGER NOT NULL,
                question TEXT NOT NULL,
                answer TEXT,
                question_type TEXT DEFAULT 'technical',
                asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                answered_at TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES interview_sessions (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        `);
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    async authenticateUser(username, password) {
        if (!this.db) await this.initDatabase();
        
        const user = await this.db.get(
            'SELECT id, username, email, full_name, student_id, is_active, password_hash FROM users WHERE username = ?',
            [username]
        );
        
        if (user && password === user.password_hash && user.is_active) {
            await this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );
            
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                student_id: user.student_id
            };
        }
        return null;
    }

    async createSession(userId, sessionDurationHours = 24) {
        if (!this.db) await this.initDatabase();
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + sessionDurationHours * 60 * 60 * 1000);
        
        try {
            await this.db.run(
                'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
                [userId, sessionToken, expiresAt.toISOString()]
            );
            return sessionToken;
        } catch (error) {
            return null;
        }
    }

    async validateSession(sessionToken) {
        if (!this.db) await this.initDatabase();
        
        const result = await this.db.get(`
            SELECT u.id, u.username, u.email, u.full_name, u.student_id, s.expires_at
            FROM users u
            JOIN sessions s ON u.id = s.user_id
            WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1
        `, [sessionToken]);
        
        if (result) {
            return {
                id: result.id,
                username: result.username,
                email: result.email,
                full_name: result.full_name,
                student_id: result.student_id
            };
        }
        return null;
    }

    async createInterviewSession(userId, sessionName = "Job Discussion", roleType = "software_development") {
        if (!this.db) await this.initDatabase();
        
        try {
            const result = await this.db.run(
                'INSERT INTO interview_sessions (user_id, session_name, role_type, total_questions) VALUES (?, ?, ?, 6)',
                [userId, sessionName, roleType]
            );
            return result.lastID;
        } catch (error) {
            console.error('Error creating interview session:', error);
            return null;
        }
    }

    async saveInterviewQuestion(sessionId, userId, questionNumber, question, questionType = "technical") {
        if (!this.db) await this.initDatabase();
        
        try {
            const result = await this.db.run(
                'INSERT INTO interview_qa (session_id, user_id, question_number, question, question_type) VALUES (?, ?, ?, ?, ?)',
                [sessionId, userId, questionNumber, question, questionType]
            );
            
            await this.db.run(
                'UPDATE interview_sessions SET questions_asked = questions_asked + 1 WHERE id = ?',
                [sessionId]
            );
            
            return result.lastID;
        } catch (error) {
            console.error('Error saving interview question:', error);
            return null;
        }
    }

    async saveInterviewAnswer(sessionId, questionNumber, answer) {
        if (!this.db) await this.initDatabase();
        
        try {
            await this.db.run(
                'UPDATE interview_qa SET answer = ?, answered_at = CURRENT_TIMESTAMP WHERE session_id = ? AND question_number = ?',
                [answer, sessionId, questionNumber]
            );
            return true;
        } catch (error) {
            console.error('Error saving interview answer:', error);
            return false;
        }
    }

    async completeInterviewSession(sessionId) {
        if (!this.db) await this.initDatabase();
        
        try {
            await this.db.run(
                'UPDATE interview_sessions SET session_status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?',
                [sessionId]
            );
            return true;
        } catch (error) {
            console.error('Error completing interview session:', error);
            return false;
        }
    }
}
