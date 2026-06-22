#!/usr/bin/env python3
import sqlite3
import hashlib
import os
from datetime import datetime

class UserDatabase:
    def __init__(self, db_file="conference_users.db"):
        self.db_file = db_file
        self.init_database()
    
    def init_database(self):
        """Initialize the database with users table"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute('''
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
            )
        ''')
        
        # Create sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Create interview_sessions table
        cursor.execute('''
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
            )
        ''')
        
        # Create interview_qa table
        cursor.execute('''
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
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def hash_password(self, password):
        """Hash password using SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register_user(self, username, email, password, full_name, student_id=None):
        """Register a new user"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            # Store password as plain string
            cursor.execute('''
                INSERT INTO users (username, email, password_hash, full_name, student_id)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, email, password, full_name, student_id))
            
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()
            return True, user_id
        except sqlite3.IntegrityError as e:
            conn.close()
            if "username" in str(e):
                return False, "Username already exists"
            elif "email" in str(e):
                return False, "Email already exists"
            elif "student_id" in str(e):
                return False, "Student ID already exists"
            else:
                return False, "Registration failed"
    
    def authenticate_user(self, username, password):
        """Authenticate user login"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        print(f"🔍 Database auth attempt:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        
        cursor.execute('''
            SELECT id, username, email, full_name, student_id, is_active, password_hash
            FROM users 
            WHERE username = ?
        ''', (username,))
        
        user_data = cursor.fetchone()
        print(f"  Found user data: {user_data[:5] if user_data else None}")
        
        if user_data:
            stored_password = user_data[6]  # password_hash field
            print(f"  Stored password: {stored_password}")
            print(f"  Passwords match: {password == stored_password}")
        
        if user_data and password == user_data[6] and user_data[5]:  # Check password string and active status
            # Update last login
            cursor.execute('''
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            ''', (user_data[0],))
            conn.commit()
            
            conn.close()
            user_info = {
                'id': user_data[0],
                'username': user_data[1],
                'email': user_data[2],
                'full_name': user_data[3],
                'student_id': user_data[4]
            }
            print(f"  ✅ Authentication successful for {username}")
            return user_info
        else:
            print(f"  ❌ Authentication failed for {username}")
            conn.close()
            return None
    
    def update_user_activity(self, user_id):
        """Update user's last active timestamp"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()

    def get_active_users(self, minutes=1):
        """Get users active in the last N minutes"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # SQLite modifiers: '-1 minutes'
        time_threshold = f'-{minutes} minutes'
        
        cursor.execute('''
            SELECT id, username, full_name 
            FROM users 
            WHERE last_login > datetime('now', ?)
        ''', (time_threshold,))
        
        users = cursor.fetchall()
        conn.close()
        
        return [{'id': u[0], 'username': u[1], 'full_name': u[2]} for u in users]
    
    def create_session(self, user_id, session_duration_hours=24):
        """Create a session for authenticated user"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Generate session token
        import secrets
        session_token = secrets.token_urlsafe(32)
        
        # Calculate expiration time
        from datetime import datetime, timedelta
        expires_at = datetime.now() + timedelta(hours=session_duration_hours)
        
        try:
            cursor.execute('''
                INSERT INTO sessions (user_id, session_token, expires_at)
                VALUES (?, ?, ?)
            ''', (user_id, session_token, expires_at))
            
            conn.commit()
            conn.close()
            return session_token
        except sqlite3.IntegrityError:
            conn.close()
            return None
    
    def validate_session(self, session_token):
        """Validate session token and return user info"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT u.id, u.username, u.email, u.full_name, u.student_id, s.expires_at
            FROM users u
            JOIN sessions s ON u.id = s.user_id
            WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1
        ''', (session_token,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'id': result[0],
                'username': result[1],
                'email': result[2],
                'full_name': result[3],
                'student_id': result[4]
            }
        return None
    
    def logout_user(self, session_token):
        """Remove session token"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM sessions WHERE session_token = ?', (session_token,))
        conn.commit()
        conn.close()
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP')
        conn.commit()
        conn.close()
    
    def create_interview_session(self, user_id, session_name="Job Discussion", role_type="software_development"):
        """Create a new interview session"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO interview_sessions (user_id, session_name, role_type, total_questions)
                VALUES (?, ?, ?, 6)
            ''', (user_id, session_name, role_type))
            
            conn.commit()
            session_id = cursor.lastrowid
            conn.close()
            return session_id
        except Exception as e:
            conn.close()
            print(f"Error creating interview session: {e}")
            return None
    
    def save_interview_question(self, session_id, user_id, question_number, question, question_type="technical"):
        """Save an interview question"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO interview_qa (session_id, user_id, question_number, question, question_type)
                VALUES (?, ?, ?, ?, ?)
            ''', (session_id, user_id, question_number, question, question_type))
            
            conn.commit()
            question_id = cursor.lastrowid
            
            # Update questions_asked count
            cursor.execute('''
                UPDATE interview_sessions SET questions_asked = questions_asked + 1
                WHERE id = ?
            ''', (session_id,))
            conn.commit()
            
            conn.close()
            return question_id
        except Exception as e:
            conn.close()
            print(f"Error saving interview question: {e}")
            return None
    
    def save_interview_answer(self, question_id, answer):
        """Save an answer to an interview question"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE interview_qa 
                SET answer = ?, answered_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (answer, question_id))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            conn.close()
            print(f"Error saving interview answer: {e}")
            return False
    
    def get_active_interview_session(self, user_id):
        """Get the active interview session for a user"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, session_name, role_type, total_questions, questions_asked, session_status
            FROM interview_sessions 
            WHERE user_id = ? AND session_status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (user_id,))
        
        session = cursor.fetchone()
        conn.close()
        
        if session:
            return {
                'id': session[0],
                'session_name': session[1],
                'role_type': session[2],
                'total_questions': session[3],
                'questions_asked': session[4],
                'session_status': session[5]
            }
        return None

    def get_shared_active_session(self):
        """Get the most recent active interview session regardless of user"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, session_name, role_type, total_questions, questions_asked, session_status
            FROM interview_sessions 
            WHERE session_status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        ''')
        
        session = cursor.fetchone()
        conn.close()
        
        if session:
            return {
                'id': session[0],
                'session_name': session[1],
                'role_type': session[2],
                'total_questions': session[3],
                'questions_asked': session[4],
                'session_status': session[5]
            }
        return None
    
    def complete_interview_session(self, session_id):
        """Mark an interview session as completed"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE interview_sessions 
                SET session_status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (session_id,))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            conn.close()
            print(f"Error completing interview session: {e}")
            return False
    
    def get_interview_history(self, user_id):
        """Get interview history for a user"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT is.id, is.session_name, is.role_type, is.total_questions, is.questions_asked,
                   is.session_status, is.created_at, is.completed_at
            FROM interview_sessions is
            WHERE is.user_id = ?
            ORDER BY is.created_at DESC
        ''', (user_id,))
        
        sessions = cursor.fetchall()
        conn.close()
        
        return [{
            'id': s[0],
            'session_name': s[1],
            'role_type': s[2],
            'total_questions': s[3],
            'questions_asked': s[4],
            'session_status': s[5],
            'created_at': s[6],
            'completed_at': s[7]
        } for s in sessions]
    
    def get_interview_qa(self, session_id):
        """Get all questions and answers for an interview session"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT qa.question_number, qa.question, qa.answer, qa.question_type, qa.asked_at, qa.answered_at, u.full_name
            FROM interview_qa qa
            LEFT JOIN users u ON qa.user_id = u.id
            WHERE qa.session_id = ?
            ORDER BY qa.question_number
        ''', (session_id,))
        
        qa_list = cursor.fetchall()
        conn.close()
        
        return [{
            'question_number': qa[0],
            'question': qa[1],
            'answer': qa[2],
            'question_type': qa[3],
            'asked_at': qa[4],
            'answered_at': qa[5],
            'answered_by': qa[6]
        } for qa in qa_list]

# Global database instance
db = UserDatabase()
