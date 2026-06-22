// Generate self-signed SSL certificate for HTTPS development
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    console.log('Generating self-signed SSL certificate...');
    
    // Generate private key and certificate
    execSync('openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Development/CN=localhost"', {
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    console.log('✅ SSL certificate generated successfully!');
    console.log('📁 Files created: server.key, server.cert');
    console.log('\n🚀 Now run: node server-https.js');
    console.log('🌐 Then visit: https://localhost:8443/conference.html');
    console.log('\n⚠️  Note: You will need to accept the self-signed certificate warning in your browser');
    
} catch (error) {
    console.error('❌ Failed to generate SSL certificate:', error.message);
    console.log('\n📝 Alternative: Install OpenSSL or use Git Bash to run:');
    console.log('openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Development/CN=localhost"');
}
