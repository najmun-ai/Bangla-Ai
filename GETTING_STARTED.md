# BoroBhai Getting Started - 5 Minute Walkthrough

Get BoroBhai running locally and experience the Bengali civic AI assistant.

## Prerequisites

- Node.js 18+ installed
- Groq API key (free at [console.groq.com](https://console.groq.com))
- AWS Account with Bedrock access (optional, for full features)

## Step 1: Clone & Install (2 minutes)

```bash
# Clone repository
git clone https://github.com/your-org/borobhai.git
cd borobhai

# Install frontend
cd app
npm install

# Create .env.local
cp .env.example .env.local
```

## Step 2: Configure Environment (1 minute)

Edit `app/.env.local`:

```bash
# Get free Groq API key from console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=gsk_your_key_here

# For AWS (optional, leave as placeholder for demo)
AWS_ACCESS_KEY_ID=placeholder_aws_key
AWS_SECRET_ACCESS_KEY=placeholder_aws_secret
AWS_REGION=us-west-2
AWS_S3_BUCKET=proofsheet-user-files

# API endpoint (local)
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000
```

## Step 3: Start Dev Server (15 seconds)

```bash
npm run dev

# Output:
# ▲ Next.js 14.0.0
# - Local:        http://localhost:3000
# 
# ✓ Ready in 2.5s
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 4: Try the Chat (1 minute)

You should see the BoroBhai home screen with a bento grid of suggestions.

### 4a. Text Query

In the chat input, type a Bengali question:

```
আমার CV তৈরি করো
```

(English: "Create my CV")

Expected response:

```
[BoroBhai responds in Bengali]
"আপনার CV তৈরি করতে আমাকে কিছু তথ্য প্রয়োজন...
আপনার নাম, শিক্ষা, কর্মঅভিজ্ঞতা বলুন।"

(Your CV needs some information... Tell me your name, education, work experience)
```

Provide details:

```
আমার নাম: রহিম
শিক্ষা: ঢাকা বিশ্ববিদ্যালয় থেকে CSE ডিগ্রি, ২০২০
কর্মঅভিজ্ঞতা: Daraz-এ Senior Developer, ৩ বছর
```

BoroBhai will:
1. Understand your input
2. Generate a professional CV in English
3. Show a DocumentCard with "Download CV"
4. Allow direct download to your computer

### 4b. Voice Input (Optional)

Click the **🎤 Microphone** button (if available in your browser):

1. Browser asks for permission (allow microphone access)
2. Click to start recording
3. Speak in Bengali: "আমার পাসপোর্ট আবেদন সাহায্য করো" (Help with my passport application)
4. Click stop
5. BoroBhai transcribes and responds

**Note**: Works best in:
- ✅ Chrome/Edge (desktop or Android)
- ✅ Safari (iOS 14.5+)
- ❌ Firefox (limited support)

## Step 5: Try File Upload (1 minute)

### 5a. Generate a Sample PDF

First, generate a document:

```
আমার CV বানাও
```

Wait for DocumentCard → Click "Download CV" → Saves as `cv.docx`

Convert to PDF (if needed):
- Open in Microsoft Word/Google Docs
- Save As → PDF

### 5b. Upload to BoroBhai

1. Click **📎 Attach File** button
2. Select your PDF/Word document
3. Click "Upload"
4. Tell BoroBhai to process it:

```
এই ফাইল থেকে একটি পাসপোর্ট আবেদন চিঠি লিখে দাও
(Write a passport application letter from this file)
```

BoroBhai will:
1. Read the uploaded file
2. Extract relevant information
3. Generate a formal letter
4. Show download

## Step 6: Explore Features

### Browse Knowledge Base

Ask civic questions BoroBhai can help with:

```
আমি আমার পাসপোর্ট রিনিউ করতে চাই, কী করব?
(I want to renew my passport, what should I do?)
```

Expected response:

```
পাসপোর্ট রিনিউ করার ধাপসমূহ:
১. ডিএমভি অফিসে যান
২. Form-32 পূরণ করুন
... [Bengali civic guidance]
```

### Try Different Document Types

BoroBhai can generate:

```
"আমার জন্য একটি সরকারি চিঠি বানাও" (Make a government letter)
"একটি ট্রেড লাইসেন্স আবেদন করি" (Apply for trade license)
"আমার বেতন সার্টিফিকেট দরকার" (I need a salary certificate)
"ছুটির আবেদন লিখে দাও" (Write a leave application)
"আমাদের মধ্যে একটি চুক্তি লাগবে" (We need an agreement)
```

## Step 7: Explore UI Components

### Split Pane Layout

```
┌──────────────────────┬─────────────────────────┐
│   Chat Messages      │   Document Preview      │
│                      │                         │
│ BoroBhai: Hello!     │  [PDF Preview or        │
│                      │   empty until           │
│ You: Hello          │    doc generated]       │
│                      │                         │
│ BoroBhai: CV made ✓  │  📄 cv.docx            │
│                      │  [Download] [Preview]  │
└──────────────────────┴─────────────────────────┘
│ [Attach] [Mic] [Send Message...]               │
└───────────────────────────────────────────────┘
```

### Message Bubbles

Messages show:
- **Role badges**: "You" (right) vs "BoroBhai" (left)
- **Flag emojis**: 📄 (document), 🎤 (voice), 📁 (file)
- **Streaming text**: Appears character-by-character
- **Timestamps**: Hover for exact time

### Document Card

When a document is generated:

```
┌─────────────────────────┐
│ 📄 CV.docx             │
│                         │
│ Generated: Just now    │
│ Size: 45 KB            │
│ Format: Word Document  │
│                         │
│ [👁️ Preview] [⬇️ Download]│
└─────────────────────────┘
```

Click **Preview** to see in browser (if PDF/image).  
Click **Download** to save to computer.

## Step 8: Next Steps

### Share with Others

```bash
# Get your Vercel deployment link
# (Once deployed, share the URL)
# https://borobhai-yourname.vercel.app
```

### Customize for Your Needs

1. **Edit system prompt**: `app/lib/prompt.ts`
2. **Add document templates**: `lambda/tools/templates/`
3. **Change colors**: `app/globals.css` or `tailwind.config.js`
4. **Add Bengali copy**: Update `app/lib/strings.ts`

### Deploy to Production

See **DEPLOYMENT.md** for:
- AWS Lambda setup
- S3 bucket configuration
- Vercel frontend deployment
- Cost optimization

## Troubleshooting

### Q: Chat not responding

**A**: Check browser console (F12 → Console). Look for red errors.

Common causes:
- Groq API key invalid → Update `.env.local`
- API endpoint wrong → Verify `NEXT_PUBLIC_API_ENDPOINT`
- AWS credentials missing → Add to `.env.local`

### Q: File upload not working

**A**: Groq API rate limit (free tier: 30 req/min).

Solution: Wait 1 minute or upgrade Groq plan.

### Q: Voice input not working

**A**: Browser doesn't support Web Speech API.

Solutions:
- Use Chrome/Edge/Safari (not Firefox)
- Grant microphone permission
- Check language set to Bengali (bn-BD)

### Q: Document download shows "Access Denied"

**A**: S3 bucket not configured.

Solutions:
- Create S3 bucket (see **DEPLOYMENT.md**)
- Update `AWS_S3_BUCKET` in `.env.local`
- Verify AWS credentials

### Q: Port 3000 already in use

**A**: Another app is using port 3000.

Solution:
```bash
# Kill existing process
lsof -i :3000
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

## Key Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Check TypeScript errors
npm run type-check

# Format code
npm run format

# Run tests (if available)
npm test
```

## File Structure

```
BoroBhai/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Main chat UI
│   ├── api/
│   │   ├── chat/          # Chat endpoint
│   │   ├── upload/        # File upload
│   │   └── stt/           # Speech-to-text
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   └── globals.css        # Tailwind styles
├── lambda/                 # AWS Lambda functions
│   ├── orchestrator/       # Bedrock chat logic
│   ├── tools/             # File processing
│   └── presign/           # S3 URL generator
├── lib/                    # Infrastructure (CDK)
├── README.md              # Project overview
├── DEPLOYMENT.md          # AWS setup guide
├── ARCHITECTURE.md        # Technical details
└── API.md                 # API reference
```

## Learn More

- **[README.md](./README.md)** — Project overview
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — How it works
- **[API.md](./API.md)** — API endpoints
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deploy to AWS
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Dev setup

## Next Steps & Support

Once you've completed this 5-minute walkthrough, you're ready to:
1. Deploy to AWS (see **DEPLOYMENT.md**)
2. Customize for your use case
3. Contribute back to the project

**Questions?** Open an issue at https://github.com/najmun-ai/Bangla-Ai or email najmun@rooscloset.store

---

Built by **RoosCloset Labs** with ❤️ for Bangladesh.  
**Website**: www.rooscloset.store  
**Email**: najmun@rooscloset.store  
**Phone**: +8801798344063

Happy exploring! 🎉
