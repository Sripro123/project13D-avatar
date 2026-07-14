# Google TTS API Setup - Quick Guide

## Current Status:
✅ AI responses working (Groq)
✅ Avatar loading and animation
✅ Text display working
❌ No speech (needs Google TTS API key)

## Step 1: Get Google TTS API Key (2 minutes)

### Option A: Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click "Select a project" → "NEW PROJECT"
4. Name it anything (e.g., "TalkingHead")
5. Wait for project to be created
6. Go to "APIs & Services" → "Library"
7. Search for "Cloud Text-to-Speech API"
8. Click on it and press "ENABLE"
9. Go to "Credentials" → "Create Credentials" → "API Key"
10. Copy the API key

### Option B: Quick Setup Link
Direct link: [Google Cloud Text-to-Speech Setup](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)

## Step 2: Add API Key to App (30 seconds)

1. Refresh your TalkingHead page: `http://localhost:3000`
2. Find the "API Keys" section
3. Look for "GoogleTTS" field
4. Paste your API key there
5. Refresh the page

## Step 3: Test!

1. Type: "Hello, can you hear me now?"
2. Press Enter
3. Avatar should speak the response!

## Free Tier Limits:
- **1 million characters per month** (very generous)
- **4,000 characters per request**
- **Enough for testing and regular use**

## Troubleshooting:
- If still no speech: Check console for errors
- If API key error: Verify key is correct
- If quota exceeded: Try next month or upgrade

The character will speak immediately once you add the Google TTS API key!
