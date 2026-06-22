#!/usr/bin/env python3
import sqlite3

# Fix the existing user's password to plain text
db_file = "conference_users.db"

try:
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Get current user
    cursor.execute('SELECT username, password_hash FROM users WHERE username = "sanal"')
    user = cursor.fetchone()
    
    if user:
        print(f"Current user: {user[0]}")
        print(f"Current stored hash: {user[1]}")
        
        # Set a plain text password (you can change this)
        new_password = "password123"  # You can change this to whatever you want
        cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?', (new_password, "sanal"))
        conn.commit()
        
        print(f"✅ Updated password to: {new_password}")
        
        # Verify the update
        cursor.execute('SELECT password_hash FROM users WHERE username = "sanal"')
        stored = cursor.fetchone()
        print(f"✅ Verified stored password: {stored[0]}")
        
    else:
        print("❌ User 'sanal' not found")
    
    conn.close()
    print("✅ Password fix completed")
    
except Exception as e:
    print(f"❌ Error: {e}")
