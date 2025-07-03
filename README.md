# Arduino AI Copilot

A comprehensive GitHub Copilot-like extension for Arduino IDE that provides AI-powered code completion, chat assistance, and multiple model support specifically tailored for Arduino development.

## Features

### 🤖 AI-Powered Code Completion
- Real-time code suggestions as you type
- Context-aware completions for Arduino-specific syntax
- Function generation based on comments
- Smart library and hardware suggestions
- Multiple completion alternatives

### 💬 Integrated Chat Assistant
- Dockable chat window within Arduino IDE
- Arduino-specific knowledge base
- Code explanation and optimization suggestions
- Hardware connection guidance
- Error troubleshooting assistance

### 🔌 Multiple AI Provider Support
- **OpenAI** (GPT-3.5, GPT-4)
- **Anthropic** (Claude models)
- **Ollama** (Local models - codellama, llama2, mistral)
- **Google Gemini**
- Easy provider switching
- Fallback system for reliability

### 🛠️ Arduino-Specific Features
- Pin configuration assistance
- Library recommendations
- Hardware compatibility checks
- Memory optimization suggestions
- Serial monitor integration
- Board-specific suggestions

## Installation

### Prerequisites
- Arduino IDE 2.x
- Java 11 or higher
- (Optional) Ollama for local AI models

### Quick Install

1. Download the latest release from the [Releases page](https://github.com/arduinoai/arduino-copilot/releases)
2. Copy `arduino-copilot.jar` to your Arduino IDE's `tools` folder:
   - Windows: `%LOCALAPPDATA%\Arduino15\tools\`
   - macOS: `~/Library/Arduino15/tools/`
   - Linux: `~/.arduino15/tools/`
3. Restart Arduino IDE
4. Access via Tools → Arduino AI Copilot

### Building from Source

```bash
git clone https://github.com/arduinoai/arduino-copilot.git
cd arduino-copilot
./gradlew shadowJar
```

The plugin JAR will be created in `build/libs/arduino-copilot-1.0.0.jar`

## Configuration

### First-Time Setup

1. Open Arduino IDE
2. Go to Tools → Arduino AI Copilot
3. Click the settings icon or press `Ctrl+Shift+S`
4. Configure your preferred AI provider:
   - For OpenAI: Enter your API key from [platform.openai.com](https://platform.openai.com)
   - For Ollama: Ensure Ollama is running locally
   - For Anthropic/Gemini: Enter respective API keys

### Configuration File

Settings are stored in `~/.arduino-copilot/arduino-copilot.conf`

Example configuration:
```hocon
arduino-copilot {
  ai {
    provider = "openai"
    
    openai {
      api-key = "sk-..."
      model = "gpt-3.5-turbo"
    }
    
    ollama {
      base-url = "http://localhost:11434"
      model = "codellama"
    }
  }
  
  completion {
    enabled = true
    auto-trigger = true
    delay-ms = 500
    min-chars = 2
  }
}
```

## Usage

### Code Completion

1. **Auto-completion**: Just type and suggestions will appear automatically
2. **Manual trigger**: Press `Ctrl+Space` to trigger completion
3. **Accept suggestion**: Press `Tab` to accept the current suggestion
4. **Navigate suggestions**: Use arrow keys to select alternatives
5. **Cancel**: Press `Esc` to dismiss suggestions

### Chat Assistant

1. **Open chat**: Press `Ctrl+Shift+A` or click Tools → Arduino AI Copilot
2. **Send message**: Type your question and press `Ctrl+Enter`
3. **Quick actions**: Use the Quick Actions tab for common tasks:
   - Explain selected code
   - Generate functions
   - Fix compilation errors
   - Suggest pin connections
   - Find libraries

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` | Trigger code completion |
| `Tab` | Accept completion |
| `Esc` | Cancel completion |
| `Ctrl+Shift+A` | Toggle AI Chat |
| `Ctrl+Shift+E` | Explain selected code |
| `Ctrl+Shift+S` | Open settings |
| `Ctrl+Enter` | Send chat message |

## Examples

### Generate a Function
1. Type a comment describing what you want:
   ```cpp
   // Function to read temperature from DHT22 sensor and return Celsius
   ```
2. Press `Ctrl+Space` after the comment
3. The AI will generate the complete function

### Fix Compilation Errors
1. When you get a compilation error
2. Open the AI chat (`Ctrl+Shift+A`)
3. Click "Fix Compilation Errors" in Quick Actions
4. The AI will analyze and suggest fixes

### Hardware Connections
1. Open Quick Actions tab
2. Click "Suggest Pin Connections"
3. Select your component (LED, Servo, Sensor, etc.)
4. Get wiring diagram and example code

## Local Models with Ollama

### Setup Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull Arduino-optimized models:
   ```bash
   ollama pull codellama
   ollama pull deepseek-coder
   ```
3. Configure in plugin settings to use Ollama provider

### Benefits of Local Models
- No API costs
- Complete privacy - code never leaves your machine
- Works offline
- Lower latency for small models

## Troubleshooting

### Plugin Not Appearing
- Ensure the JAR is in the correct `tools` folder
- Check Arduino IDE version (requires 2.x)
- Look for errors in Arduino IDE's console

### Completion Not Working
- Verify API keys are correctly set
- Check internet connection (for cloud providers)
- Try manual trigger (`Ctrl+Space`)
- Check settings for auto-completion enabled

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check the base URL (default: `http://localhost:11434`)
- Verify model is downloaded: `ollama list`

## Privacy & Security

- API keys are encrypted locally using AES-256
- Local models (Ollama) keep all code on your machine
- Cloud providers: Review their data policies
- Option to disable context sharing in settings

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Clone the repository
2. Import into your IDE as a Gradle project
3. Run tests: `./gradlew test`
4. Build: `./gradlew shadowJar`

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Arduino IDE team for the plugin architecture
- OpenAI, Anthropic, Ollama teams for AI models
- All contributors and testers

## Support

- **Issues**: [GitHub Issues](https://github.com/arduinoai/arduino-copilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/arduinoai/arduino-copilot/discussions)
- **Wiki**: [Documentation Wiki](https://github.com/arduinoai/arduino-copilot/wiki)