# Irene - AI Fairy Assistant

A magical AI assistant powered by Google's Gemini API, built with Electron.

## 📁 Project Structure

```
olivia/
├── src/                          # Source code organized by feature
│   ├── api/                      # API clients
│   │   └── gemini-api.js        # Gemini API communication
│   ├── database/                 # Data persistence
│   │   └── database.js          # SQLite chat history management
│   ├── ui/                       # User interface logic
│   │   └── renderer.js          # Main UI controller
│   └── utils/                    # Utility modules
│       ├── config.js            # Configuration management
│       ├── parser.js            # Response parsing utilities
│       └── markdown-formatter.js # Markdown to HTML conversion
│
├── chat_history/                 # SQLite database storage
│   └── conversations.db         # Chat history database
│
├── main.js                       # Electron main process (window management)
├── preload.js                    # Secure IPC bridge
├── index.html                    # Main UI layout
├── style.css                     # Styles and theme
├── config.js                     # User configuration (API keys, settings)
├── config.example.js             # Configuration template
└── package.json                  # Dependencies and scripts

```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Yarn or npm
- Google Gemini API key

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd olivia
   yarn install
   ```

2. **Configure API key:**
   ```bash
   # Copy example config
   copy config.example.js config.js
   
   # Edit config.js and add your Gemini API key
   ```

3. **Run the application:**
   ```bash
   yarn start
   ```

## ⚙️ Configuration

Edit `config.js` to customize:
- **GEMINI_API_KEY**: Your Google Gemini API key
- **SYSTEM_PROMPT_BEFORE**: AI personality and behavior
- **AI_TEMPERATURE**: Response creativity (0.0-1.0)
- **MAX_RESPONSE_LENGTH**: Maximum response characters
- **FALLBACK_RESPONSE**: Offline/error response

## 🎨 Features

- ✨ **Magical Chat Interface** - Beautiful, intuitive UI
- 💬 **Conversation History** - Persistent chat sessions
- 🤖 **AI-Powered Responses** - Google Gemini integration
- ⌨️ **Command Execution** - Safe system command parsing
- 🔄 **Auto-Summarization** - Long conversation summaries
- 🏷️ **Auto-Titles** - Smart chat naming

## 📚 Module Overview

### Main Process (`main.js`)
- Window creation and management
- IPC handlers for UI communication
- App lifecycle management

### API Layer (`src/api/gemini-api.js`)
- Gemini API communication
- Request/response handling
- Summary and title generation
- Command output parsing

### Database (`src/database/database.js`)
- SQLite chat storage
- History retrieval and formatting
- Chat session management

### UI Layer (`src/ui/renderer.js`)
- User interactions
- Message display
- Command execution UI
- Chat history panel

### Utilities (`src/utils/`)
- **config.js**: Configuration loader
- **parser.js**: Response parsing
- **markdown-formatter.js**: Markdown rendering

## 🔒 Security

- Context isolation enabled
- No direct Node.js access from renderer
- Secure IPC communication via preload script
- Command execution with timeout and size limits

## 🛠️ Development

```bash
# Run in development mode
yarn start

# Build for production (add build scripts as needed)
# yarn build
```

## 📝 License

MIT License - See LICENSE.txt

## 👨‍💻 Author

Frank Mathew Sajan

---

Made with ✨ by Irene
