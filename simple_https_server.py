#!/usr/bin/env python3
import http.server
import ssl
import socketserver
import os
import sys
import json
import sqlite3
from urllib.parse import urlparse, parse_qs
from http.cookies import SimpleCookie
import secrets

# Import database module
from database import db

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8443

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for IP access
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def get_session_token(self):
        """Get session token from cookies"""
        cookie_header = self.headers.get('Cookie')
        if cookie_header:
            cookie = SimpleCookie(cookie_header)
            if 'session_token' in cookie:
                return cookie['session_token'].value
        return None

    def set_session_cookie(self, session_token):
        """Set session cookie"""
        cookie = SimpleCookie()
        cookie['session_token'] = session_token
        cookie['session_token']['path'] = '/'
        cookie['session_token']['httponly'] = True
        cookie['session_token']['secure'] = True
        self.send_header('Set-Cookie', cookie.output(header=''))

    def clear_session_cookie(self):
        """Clear session cookie"""
        cookie = SimpleCookie()
        cookie['session_token'] = ''
        cookie['session_token']['path'] = '/'
        cookie['session_token']['httponly'] = True
        cookie['session_token']['secure'] = True
        cookie['session_token']['max-age'] = 0
        self.send_header('Set-Cookie', cookie.output(header=''))

    def is_authenticated(self):
        """Check if user is authenticated"""
        session_token = self.get_session_token()
        if session_token:
            user = db.validate_session(session_token)
            return user is not None, user
        return False, None

    def do_GET(self):
        # Parse the path
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Handle API routes
        if path.startswith('/api/'):
            self.handle_api_get(path)
            return
        
        # Serve static files with authentication check
        if path == '/' or path == '/login.html':
            self.serve_file('login.html', 'text/html')
        elif path == '/landing.html':
            # Check authentication
            is_auth, user = self.is_authenticated()
            if not is_auth:
                self.redirect_to_login()
                return
            self.serve_file('landing.html', 'text/html')
        elif path == '/conference.html':
            # Check authentication
            is_auth, user = self.is_authenticated()
            if not is_auth:
                self.redirect_to_login()
                return
            self.serve_file('conference.html', 'text/html')
        elif path == '/session-history.html':
            # Check authentication
            is_auth, user = self.is_authenticated()
            if not is_auth:
                self.redirect_to_login()
                return
            self.serve_file('session-history.html', 'text/html')
        else:
            self.serve_static_file(path)

    def do_POST(self):
        # Parse the path
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Handle API routes
        if path.startswith('/api/'):
            self.handle_api_post(path)
            return
        
        # Default 404 for other POST requests
        self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def handle_api_get(self, path):
        """Handle GET API requests"""
        print(f"🔍 API GET request for path: {path}")
        
        if path == '/api/check-auth':
            is_auth, user = self.is_authenticated()
            self.send_json_response({
                'authenticated': is_auth,
                'user': user if is_auth else None
            })
        elif path == '/api/user-info':
            is_auth, user = self.is_authenticated()
            if is_auth:
                self.send_json_response({
                    'success': True,
                    'user': user
                })
            else:
                self.send_json_response({
                    'success': False,
                    'message': 'Not authenticated'
                }, 401)
        elif path == '/api/interview/session':
            self.handle_get_session()
        elif path == '/api/participants':
            self.handle_get_participants()
        else:
            print(f"❌ API endpoint not found: {path}")
            self.send_json_response({'error': 'API endpoint not found'}, 404)

    def handle_api_post(self, path):
        """Handle POST API requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return

        if path == '/api/register':
            self.handle_register(data)
        elif path == '/api/login':
            self.handle_login(data)
        elif path == '/api/logout':
            self.handle_logout()
        elif path == '/api/interview/start':
            self.handle_start_interview()
        elif path == '/api/interview/question':
            self.handle_save_question()
        elif path == '/api/interview/answer':
            self.handle_save_answer()
        elif path == '/api/interview/complete':
            self.handle_complete_interview()
        elif path == '/api/interview/history':
            self.handle_interview_history()
        elif path == '/api/interview/session':
            self.handle_get_session()
        elif path == '/api/interview/poll':
            self.handle_poll_session()
        elif path == '/api/participants':
            self.handle_get_participants()
        else:
            self.send_json_response({'error': 'API endpoint not found'}, 404)

    def handle_register(self, data):
        """Handle user registration"""
        required_fields = ['username', 'email', 'password', 'fullName']
        for field in required_fields:
            if field not in data or not data[field]:
                self.send_json_response({
                    'success': False,
                    'message': f'{field} is required'
                }, 400)
                return

        # Validate email format
        if '@' not in data['email']:
            self.send_json_response({
                'success': False,
                'message': 'Invalid email format'
            }, 400)
            return

        # Validate password length
        if len(data['password']) < 6:
            self.send_json_response({
                'success': False,
                'message': 'Password must be at least 6 characters long'
            }, 400)
            return

        # Register user
        success, result = db.register_user(
            data['username'],
            data['email'],
            data['password'],
            data['fullName'],
            data.get('studentId')
        )

        if success:
            self.send_json_response({
                'success': True,
                'message': 'Registration successful',
                'user_id': result
            })
        else:
            self.send_json_response({
                'success': False,
                'message': result
            }, 400)

    def handle_login(self, data):
        """Handle user login"""
        print(f"🔍 Login attempt for username: {data.get('username')}")
        
        if 'username' not in data or 'password' not in data:
            print("❌ Missing username or password")
            response_data = {
                'success': False,
                'message': 'Username and password are required'
            }
            self.wfile.write(f"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {len(json.dumps(response_data))}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{json.dumps(response_data)}".encode())
            return

        user = db.authenticate_user(data['username'], data['password'])
        print(f"🔍 Authentication result: {user}")
        
        if user:
            # Create session
            print(f"🔍 Creating session for user ID: {user['id']}")
            session_token = db.create_session(user['id'])
            print(f"🔍 Session token created: {session_token}")
            
            if session_token:
                self.set_session_cookie(session_token)
                response_data = {
                    'success': True,
                    'message': 'Login successful',
                    'user': user
                }
                print(f"🔍 Sending response: {response_data}")
                
                # Manual HTTP response
                json_response = json.dumps(response_data)
                response = f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {len(json_response)}\r\nAccess-Control-Allow-Origin: *\r\nSet-Cookie: session_token={session_token}; Path=/; HttpOnly; Secure\r\n\r\n{json_response}"
                self.wfile.write(response.encode())
                print(f"✅ Login successful for {data['username']}")
            else:
                print("❌ Failed to create session")
                response_data = {'success': False, 'message': 'Failed to create session'}
                json_response = json.dumps(response_data)
                response = f"HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {len(json_response)}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{json_response}"
                self.wfile.write(response.encode())
        else:
            print(f"❌ Invalid credentials for {data['username']}")
            response_data = {'success': False, 'message': 'Invalid username or password'}
            json_response = json.dumps(response_data)
            response = f"HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {len(json_response)}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{json_response}"
            self.wfile.write(response.encode())

    def handle_logout(self):
        """Handle user logout"""
        session_token = self.get_session_token()
        if session_token:
            db.logout_user(session_token)
        
        self.clear_session_cookie()
        self.send_json_response({
            'success': True,
            'message': 'Logout successful'
        })

    def handle_start_interview(self):
        """Handle starting a new interview session"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        # Check for existing shared session first
        existing_session = db.get_shared_active_session()
        if existing_session:
            self.send_json_response({
                'success': True,
                'message': 'Joined existing shared session',
                'session_id': existing_session['id'],
                'session': existing_session
            })
            return

        session_id = db.create_interview_session(user['id'])
        if session_id:
            self.send_json_response({
                'success': True,
                'message': 'Interview session started',
                'session_id': session_id
            })
        else:
            self.send_json_response({'success': False, 'message': 'Failed to start interview'}, 500)

    def handle_save_question(self):
        """Handle saving an interview question"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return
        
        required_fields = ['session_id', 'question_number', 'question']
        for field in required_fields:
            if field not in data:
                self.send_json_response({'success': False, 'message': f'{field} is required'}, 400)
                return
        
        question_id = db.save_interview_question(
            data['session_id'], 
            user['id'], 
            data['question_number'], 
            data['question'],
            data.get('question_type', 'technical')
        )
        
        if question_id:
            self.send_json_response({
                'success': True,
                'message': 'Question saved',
                'question_id': question_id
            })
        else:
            self.send_json_response({'success': False, 'message': 'Failed to save question'}, 500)

    def handle_save_answer(self):
        """Handle saving an interview answer"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return
        
        if 'question_id' not in data or 'answer' not in data:
            self.send_json_response({'success': False, 'message': 'question_id and answer are required'}, 400)
            return
        
        success = db.save_interview_answer(data['question_id'], data['answer'])
        
        if success:
            self.send_json_response({
                'success': True,
                'message': 'Answer saved'
            })
        else:
            self.send_json_response({'success': False, 'message': 'Failed to save answer'}, 500)

    def handle_complete_interview(self):
        """Handle completing an interview session"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return
        
        if 'session_id' not in data:
            self.send_json_response({'success': False, 'message': 'session_id is required'}, 400)
            return
        
        success = db.complete_interview_session(data['session_id'])
        
        if success:
            self.send_json_response({
                'success': True,
                'message': 'Interview session completed'
            })
        else:
            self.send_json_response({'success': False, 'message': 'Failed to complete interview'}, 500)

    def handle_interview_history(self):
        """Handle getting interview history"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        history = db.get_interview_history(user['id'])
        
        self.send_json_response({
            'success': True,
            'history': history
        })

    def handle_get_session(self):
        """Handle getting active interview session"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
        
        session = db.get_active_interview_session(user['id'])
        
        if session:
            self.send_json_response({
                'success': True,
                'session': session
            })
        else:
            self.send_json_response({
                'success': False,
                'message': 'No active session found'
            })

    def handle_poll_session(self):
        """Handle polling for session updates"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return

        # Update activity
        db.update_user_activity(user['id'])

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return

        if 'session_id' not in data:
            self.send_json_response({'success': False, 'message': 'session_id is required'}, 400)
            return

        # Get session info to check status
        conn = sqlite3.connect(db.db_file)
        cursor = conn.cursor()
        cursor.execute('SELECT questions_asked, session_status FROM interview_sessions WHERE id = ?', (data['session_id'],))
        session_info = cursor.fetchone()
        conn.close()

        if not session_info:
             self.send_json_response({'success': False, 'message': 'Session not found'}, 404)
             return

        # Get latest Q&A
        qa_list = db.get_interview_qa(data['session_id'])
        
        self.send_json_response({
            'success': True,
            'questions_asked': session_info[0],
            'session_status': session_info[1],
            'qa_list': qa_list
        })

    def handle_get_participants(self):
        """Handle getting active participants"""
        is_auth, user = self.is_authenticated()
        if not is_auth:
            self.send_json_response({'success': False, 'message': 'Not authenticated'}, 401)
            return
            
        # Get active users (last 1 minute)
        active_users = db.get_active_users(minutes=1)
        
        self.send_json_response({
            'success': True,
            'participants': active_users
        })

    def serve_file(self, filename, content_type):
        try:
            with open(filename, 'rb') as f:
                self.send_response(200)
                self.send_header('Content-type', content_type)
                super().end_headers()
                self.wfile.write(f.read())
        except FileNotFoundError:
            self.send_error(404, "File Not Found")

    def serve_static_file(self, path):
        """Serve static files with proper MIME types"""
        if path == '/':
            path = '/login.html'
        
        filename = path[1:]  # Remove leading slash
        
        # Determine content type
        if filename.endswith('.html'):
            content_type = 'text/html'
        elif filename.endswith('.js'):
            content_type = 'application/javascript'
        elif filename.endswith('.mjs'):
            content_type = 'application/javascript'
        elif filename.endswith('.css'):
            content_type = 'text/css'
        elif filename.endswith('.json'):
            content_type = 'application/json'
        elif filename.endswith('.glb'):
            content_type = 'model/gltf-binary'
        else:
            content_type = 'application/octet-stream'
        
        self.serve_file(filename, content_type)

    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        response_data = json.dumps(data)
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Content-Length', str(len(response_data)))
        self.end_headers()
        self.wfile.write(response_data.encode('utf-8'))

    def redirect_to_login(self):
        """Redirect to login page"""
        self.send_response(302)
        self.send_header('Location', '/login.html')
        self.end_headers()  # Changed from super().end_headers()

class ReuseAddrTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

def run_https_server():
    # Generate or load SSL certificate
    cert_file = "server.cert"
    key_file = "server.key"
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("SSL certificates not found. Please run generate-cert-ip.bat first")
        return
    
    # Create server
    with ReuseAddrTCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        # Wrap with SSL
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_file, keyfile=key_file)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        # Get local IP addresses
        import socket
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        print(f"🔒 HTTPS Server running on port {PORT}")
        print("=" * 50)
        print("ACCESS URLs:")
        print(f"- Local: https://localhost:{PORT}/")
        print(f"- Network: https://{local_ip}:{PORT}/")
        print(f"- Alternative: https://10.111.78.35:{PORT}/")
        print("Note: Accept the security certificate warning in browser")
        print("=" * 50)
        print("📋 Authentication System Active")
        print("📋 Database initialized")
        print("=" * 50)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run_https_server()
