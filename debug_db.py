#!/usr/bin/env python3
import sqlite3

# Direct database access
db_file = "conference_users.db"
print("=== Database Debug ===")

try:
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Get all users
    users = cursor.execute('SELECT id, username, email, password_hash, full_name FROM users').fetchall()
    print(f"Found {len(users)} users:")
    for user in users:
        print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Hash: {user[3][:20]}..., Name: {user[4]}")
    
    # Test authentication manually
    if users:
        test_user = users[1] if len(users) > 1 else users[0]  # Get the registered user
        print(f"\n=== Testing Authentication for {test_user[1]} ===")
        
        # Test hash function
        import hashlib
        test_password = "password123"  # Common test password
        test_hash = hashlib.sha256(test_password.encode()).hexdigest()
        print(f"Hash of '{test_password}': {test_hash}")
        print(f"Stored hash: {test_user[3]}")
        print(f"Hashes match: {test_hash == test_user[3]}")
        
        # Try different common passwords
        common_passwords = ["password123", "123456", "password", "admin123"]
        for pwd in common_passwords:
            pwd_hash = hashlib.sha256(pwd.encode()).hexdigest()
            if pwd_hash == test_user[3]:
                print(f"✅ Found matching password: '{pwd}'")
                break
        else:
            print("❌ No common passwords matched")
        
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")

print("\n=== Database Schema ===")
try:
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    schema = cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'").fetchall()
    for table in schema:
        print(table[0])
    conn.close()
except Exception as e:
    print(f"Error: {e}")
