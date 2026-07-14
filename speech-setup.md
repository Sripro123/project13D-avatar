# How to Enable Avatar Speech

## Current Status:
✅ AI responses are working  
✅ Avatar is loading  
✅ Text responses are displaying  
❌ No speech (needs TTS API key)

## Quick Fix - Add Google TTS API Key:

### Step 1: Get Google TTS API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Cloud Text-to-Speech API"
4. Create credentials → API Key
5. Copy the API key

### Step 2: Add API Key to App
1. In the TalkingHead interface, find the "API Keys" section
2. Look for "GoogleTTS" field
3. Paste your API key there
4. Refresh the page

### Step 3: Test
1. Type a message
2. Press Enter
3. Avatar should now speak the response!

## Alternative: Use Free TTS Services

If you don't want to set up Google TTS, you can try:
- ElevenLabs API (free tier available)
- Microsoft TTS API (requires Azure account)

## What's Working Now:
- AI responses via Groq
- Avatar animations
- Text display
- JWT authentication bypassed

The avatar will speak once you add any TTS API key!
