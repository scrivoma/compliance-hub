# LiveKit Setup Guide

## Option 1: LiveKit Cloud (Recommended for Testing)

1. **Sign up for LiveKit Cloud**:
   - Go to https://cloud.livekit.io/
   - Sign up for a free account
   - Create a new project

2. **Get your credentials**:
   - In your LiveKit Cloud dashboard, go to Settings > Keys
   - Copy your:
     - `LIVEKIT_URL` (e.g., `wss://myproject-xxxxxxxx.livekit.cloud`)
     - `LIVEKIT_API_KEY`
     - `LIVEKIT_API_SECRET`

3. **Update environment variables**:
   Add to your `.env.local` file:
   ```bash
   # LiveKit Configuration
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   ```

4. **Update agent environment**:
   Update `/agents/.env` with the same credentials plus your OpenAI key:
   ```bash
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   OPENAI_API_KEY=your-openai-api-key
   ```

## Option 2: Local LiveKit Server (For Development)

1. **Install LiveKit Server**:
   ```bash
   brew install livekit
   ```

2. **Start local server**:
   ```bash
   livekit-server --dev
   ```

3. **Use local configuration**:
   ```bash
   LIVEKIT_URL=ws://localhost:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```

## Running the System

1. **Start your Next.js app** (if not already running):
   ```bash
   npm run dev
   ```

2. **Start the LiveKit Agent**:
   ```bash
   cd agents
   source agent_env/bin/activate
   python compliance_agent.py start
   ```

3. **Test the voice assistant**:
   - Open your app in the browser
   - Click the voice assistant button in the bottom right
   - Start speaking!

## How It Works

1. **Frontend (React/LiveKit Client)**:
   - Connects to LiveKit room
   - Captures microphone audio
   - Plays back agent audio responses
   - Handles UI states

2. **Backend Agent (Python/LiveKit Agents)**:
   - Connects to same LiveKit room
   - Uses OpenAI Realtime API for voice processing
   - Has access to ChromaDB search tool
   - Responds with natural voice

3. **LiveKit Infrastructure**:
   - Handles real-time audio streaming
   - Manages WebRTC connections
   - Provides low-latency audio transport

## Troubleshooting

- **Connection Issues**: Check your LiveKit credentials
- **Audio Issues**: Ensure microphone permissions are granted
- **Agent Not Responding**: Check the agent logs and ensure it's connected to the room
- **ChromaDB Search**: Ensure your Next.js API is running on localhost:3000

## Benefits of This Approach

✅ **Professional Audio Quality**: LiveKit handles WebRTC optimization
✅ **Low Latency**: Optimized for real-time voice applications  
✅ **Reliable**: Production-ready infrastructure
✅ **Simple Integration**: Much easier than custom WebSocket/WebRTC
✅ **Scalable**: Works from development to production
✅ **Tool Integration**: Easy to add ChromaDB and other tools