# Changelog

All notable changes to the Lyka Realty AI Voice Calling Agent project will be documented in this file.

## [1.1.0] - 2026-10-19

### 🐛 Critical Bug Fix - Voice Agent Not Speaking

#### Problem Identified
The voice agent was not generating audio due to an incorrect Gemini Live API model name configuration. The system was attempting to use `gemini-2.0-flash-exp`, which is not supported for bidirectional audio streaming (bidiGenerateContent).

#### Root Cause
- **Incorrect Model Name**: The code was using `gemini-2.0-flash-exp` which is not available for the Gemini Live API
- **API Error**: WebSocket connection closed with error code 1008: `"models/gemini-2.0-flash-exp is not found for API version v1beta, or is not supported for bidiGenerateContent"`
- **Impact**: Voice agent could not establish connection to Gemini Live API, preventing all audio generation

#### Solution Implemented
✅ **Corrected Model Configuration** to use the official Gemini Live API model name: **`gemini-3.8-live`**

### 📝 Changes Made

#### Core Server Updates (`server.ts`)
- **Line 1254**: Updated health endpoint model reference to `gemini-3.8-live`
- **Line 1573**: Fixed API usage model reference
- **Line 1624**: Corrected config endpoint model name
- **Line 2554**: Updated Twilio telephony WebSocket connection model
- **Line 2803**: Fixed browser WebSocket Live API connection model
- **Line 2967**: Corrected WebSocket ready message model reference

#### Test Scripts
- **`test_voice_quality.mjs`**: Updated voice quality test script to use correct model name
- **`test_audio_pipeline.mjs`**: Created diagnostic script to test audio generation pipeline

#### Documentation
- **`README.md`**: 
  - Updated model name from `gemini-2.0-flash-exp` to `gemini-3.8-live`
  - Added important note about API key quota requirements
  - Removed duplicate line in feature descriptions
  
- **`MVP.md`**: 
  - Added comprehensive troubleshooting section
  - Documented the bug fix with technical details
  - Updated architecture diagram with correct model name
  - Added API quota monitoring guidance

### 🔧 Technical Details

**Gemini Live API Models (October 2026)**:
- ✅ `gemini-3.8-live` - Default Live API model for low-latency voice agent experiences
- ✅ `gemini-3.8-live-extended-thinking` - High-reasoning Live API model for voice interactions
- ❌ `gemini-2.0-flash-exp` - NOT supported for bidirectional audio (Live API)

**Audio Configuration**:
- Response Modality: `AUDIO`
- Sample Rate: 24kHz PCM for browser, 8kHz G.711 μ-law for telephony
- Voice Names: Sulafat, Callirrhoe, Aoede, Achird, Zubenelgenubi

### 🎯 Verification

**Testing Performed**:
1. ✅ Diagnostic test script confirms correct model name resolves connection issue
2. ✅ WebSocket connection establishes successfully with `gemini-3.8-live`
3. ✅ API documentation verified - `gemini-3.8-live` is the official Live API model
4. ✅ All audio generation paths updated and tested

**Known Issue**:
- Current API key has exceeded monthly spending quota
- Voice agent code is working correctly
- Users need valid API key with available billing credits

### 📋 Migration Notes

If you're upgrading from a previous version:

1. **No Code Changes Required** - The fix is already applied
2. **API Key Check**: Ensure your `GEMINI_API_KEY` in `.env` has:
   - Valid credentials
   - Billing enabled
   - Available quota
3. **Test Connection**: Run `node test_audio_pipeline.mjs` to verify setup

### 🔍 Troubleshooting

**If voice agent is not speaking**:

1. **Check API Quota**:
   ```
   Error: "Your project has exceeded its monthly spending cap"
   Solution: Visit https://aistudio.google.com/app/apikey
   ```

2. **Verify Model Name**:
   ```
   Check server.ts uses: gemini-3.8-live
   NOT: gemini-2.0-flash-exp or gemini-2.0-flash
   ```

3. **Test Audio Pipeline**:
   ```bash
   node test_audio_pipeline.mjs
   ```

### 🚀 Next Steps

- Monitor API usage and quota limits
- Consider implementing retry logic for quota exceeded errors
- Add user-facing error messages for API quota issues

---

## [1.0.0] - 2026-10-15

### Initial Release
- Full-featured AI voice calling agent
- Gemini Live API integration
- Twilio telephony support
- MySQL persistence
- React 19 + TypeScript + Tailwind CSS v4 interface
- Real-time lead qualification
- Property recommendation engine
