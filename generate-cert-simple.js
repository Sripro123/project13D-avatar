// Generate self-signed SSL certificate using Node.js built-in crypto
import { selfsigned } from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__dirname);

try {
    console.log('Generating self-signed SSL certificate...');
    
    // Generate certificate attributes
    const attrs = [
        { name: 'countryName', value: 'US' },
        { name: 'stateName', value: 'State' },
        { name: 'localityName', value: 'City' },
        { name: 'organizationName', value: 'Development' },
        { name: 'commonName', value: 'localhost' }
    ];
    
    // Generate self-signed certificate
    const pems = selfsigned.generate(attrs, { days: 365 });
    
    // Write certificate files
    fs.writeFileSync(path.join(__dirname, 'server.key'), pems.private);
    fs.writeFileSync(path.join(__dirname, 'server.cert'), pems.cert);
    
    console.log('✅ SSL certificate generated successfully!');
    console.log('📁 Files created: server.key, server.cert');
    console.log('\n🚀 Now run: node server-https.js');
    console.log('🌐 Then visit: https://localhost:8443/conference.html');
    console.log('\n⚠️  Note: You will need to accept the self-signed certificate warning in your browser');
    
} catch (error) {
    console.error('❌ Failed to generate SSL certificate:', error.message);
    console.log('\n📝 Installing required package...');
    
    // Try to install selfsigned package
    const { execSync } = await import('child_process');
    try {
        execSync('npm install selfsigned', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ Package installed. Please run this script again.');
    } catch (installError) {
        console.error('❌ Failed to install package:', installError.message);
    }
}
