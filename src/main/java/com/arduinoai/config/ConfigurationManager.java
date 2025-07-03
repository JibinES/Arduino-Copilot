package com.arduinoai.config;

import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import com.typesafe.config.ConfigRenderOptions;
import com.typesafe.config.ConfigValueFactory;
import org.jasypt.util.text.AES256TextEncryptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

public class ConfigurationManager {
    
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationManager.class);
    private static ConfigurationManager instance;
    
    private static final String CONFIG_FILE = "arduino-copilot.conf";
    private static final String SECRET_KEY = "ArduinoCopilotSecret2024";
    
    private Config config;
    private final AES256TextEncryptor encryptor;
    private final List<ConfigurationListener> listeners;
    
    public interface ConfigurationListener {
        void onConfigurationChanged(String key, Object value);
    }
    
    private ConfigurationManager() {
        this.encryptor = new AES256TextEncryptor();
        this.encryptor.setPassword(SECRET_KEY);
        this.listeners = new ArrayList<>();
    }
    
    public static synchronized ConfigurationManager getInstance() {
        if (instance == null) {
            instance = new ConfigurationManager();
        }
        return instance;
    }
    
    public void loadConfiguration() {
        try {
            File configFile = getConfigFile();
            if (configFile.exists()) {
                config = ConfigFactory.parseFile(configFile)
                    .withFallback(getDefaultConfig())
                    .resolve();
            } else {
                config = getDefaultConfig();
                saveConfiguration();
            }
            logger.info("Configuration loaded successfully");
        } catch (Exception e) {
            logger.error("Failed to load configuration, using defaults", e);
            config = getDefaultConfig();
        }
    }
    
    public void saveConfiguration() {
        try {
            File configFile = getConfigFile();
            FileWriter writer = new FileWriter(configFile);
            writer.write(config.root().render(ConfigRenderOptions.defaults()
                .setOriginComments(false)
                .setJson(false)));
            writer.close();
            logger.info("Configuration saved successfully");
        } catch (IOException e) {
            logger.error("Failed to save configuration", e);
        }
    }
    
    private File getConfigFile() {
        String userHome = System.getProperty("user.home");
        File configDir = new File(userHome, ".arduino-copilot");
        if (!configDir.exists()) {
            configDir.mkdirs();
        }
        return new File(configDir, CONFIG_FILE);
    }
    
    private Config getDefaultConfig() {
        return ConfigFactory.parseString(
            "arduino-copilot {\n" +
            "  # AI Provider Settings\n" +
            "  ai {\n" +
            "    provider = \"openai\"\n" +
            "    \n" +
            "    openai {\n" +
            "      api-key = \"\"\n" +
            "      model = \"gpt-3.5-turbo\"\n" +
            "    }\n" +
            "    \n" +
            "    anthropic {\n" +
            "      api-key = \"\"\n" +
            "      model = \"claude-3-haiku-20240307\"\n" +
            "    }\n" +
            "    \n" +
            "    ollama {\n" +
            "      base-url = \"http://localhost:11434\"\n" +
            "      model = \"codellama\"\n" +
            "    }\n" +
            "    \n" +
            "    gemini {\n" +
            "      api-key = \"\"\n" +
            "      model = \"gemini-pro\"\n" +
            "    }\n" +
            "  }\n" +
            "  \n" +
            "  # Code Completion Settings\n" +
            "  completion {\n" +
            "    enabled = true\n" +
            "    auto-trigger = true\n" +
            "    delay-ms = 500\n" +
            "    min-chars = 2\n" +
            "    max-tokens = 150\n" +
            "    temperature = 0.2\n" +
            "  }\n" +
            "  \n" +
            "  # Chat Settings\n" +
            "  chat {\n" +
            "    max-tokens = 1000\n" +
            "    history-size = 20\n" +
            "    include-context = true\n" +
            "  }\n" +
            "  \n" +
            "  # UI Settings\n" +
            "  ui {\n" +
            "    theme = \"light\"\n" +
            "    font-size = 12\n" +
            "    window-width = 400\n" +
            "    window-height = 600\n" +
            "  }\n" +
            "}\n"
        );
    }
    
    // Configuration getters
    
    public String getSelectedProvider() {
        return config.getString("arduino-copilot.ai.provider");
    }
    
    public void setSelectedProvider(String provider) {
        config = config.withValue("arduino-copilot.ai.provider", 
                                  ConfigValueFactory.fromAnyRef(provider));
        notifyListeners("ai.provider", provider);
        saveConfiguration();
    }
    
    // OpenAI settings
    public String getOpenAIApiKey() {
        String encrypted = config.getString("arduino-copilot.ai.openai.api-key");
        return decryptValue(encrypted);
    }
    
    public void setOpenAIApiKey(String apiKey) {
        String encrypted = encryptValue(apiKey);
        config = config.withValue("arduino-copilot.ai.openai.api-key", 
                                  ConfigValueFactory.fromAnyRef(encrypted));
        saveConfiguration();
    }
    
    public String getOpenAIModel() {
        return config.getString("arduino-copilot.ai.openai.model");
    }
    
    public void setOpenAIModel(String model) {
        config = config.withValue("arduino-copilot.ai.openai.model", 
                                  ConfigValueFactory.fromAnyRef(model));
        saveConfiguration();
    }
    
    // Anthropic settings
    public String getAnthropicApiKey() {
        String encrypted = config.getString("arduino-copilot.ai.anthropic.api-key");
        return decryptValue(encrypted);
    }
    
    public void setAnthropicApiKey(String apiKey) {
        String encrypted = encryptValue(apiKey);
        config = config.withValue("arduino-copilot.ai.anthropic.api-key", 
                                  ConfigValueFactory.fromAnyRef(encrypted));
        saveConfiguration();
    }
    
    // Ollama settings
    public String getOllamaBaseUrl() {
        return config.getString("arduino-copilot.ai.ollama.base-url");
    }
    
    public void setOllamaBaseUrl(String url) {
        config = config.withValue("arduino-copilot.ai.ollama.base-url", 
                                  ConfigValueFactory.fromAnyRef(url));
        saveConfiguration();
    }
    
    public String getOllamaModel() {
        return config.getString("arduino-copilot.ai.ollama.model");
    }
    
    public void setOllamaModel(String model) {
        config = config.withValue("arduino-copilot.ai.ollama.model", 
                                  ConfigValueFactory.fromAnyRef(model));
        saveConfiguration();
    }
    
    // Completion settings
    public boolean isAutoCompletionEnabled() {
        return config.getBoolean("arduino-copilot.completion.enabled") &&
               config.getBoolean("arduino-copilot.completion.auto-trigger");
    }
    
    public int getCompletionDelay() {
        return config.getInt("arduino-copilot.completion.delay-ms");
    }
    
    public int getMinCompletionChars() {
        return config.getInt("arduino-copilot.completion.min-chars");
    }
    
    public int getMaxCompletionTokens() {
        return config.getInt("arduino-copilot.completion.max-tokens");
    }
    
    public double getCompletionTemperature() {
        return config.getDouble("arduino-copilot.completion.temperature");
    }
    
    // Chat settings
    public int getMaxChatTokens() {
        return config.getInt("arduino-copilot.chat.max-tokens");
    }
    
    public int getChatHistorySize() {
        return config.getInt("arduino-copilot.chat.history-size");
    }
    
    // Encryption helpers
    private String encryptValue(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        try {
            return encryptor.encrypt(value);
        } catch (Exception e) {
            logger.error("Failed to encrypt value", e);
            return "";
        }
    }
    
    private String decryptValue(String encrypted) {
        if (encrypted == null || encrypted.isEmpty()) {
            return "";
        }
        try {
            return encryptor.decrypt(encrypted);
        } catch (Exception e) {
            // Not encrypted or invalid
            return encrypted;
        }
    }
    
    // Listener management
    public void addConfigurationListener(ConfigurationListener listener) {
        listeners.add(listener);
    }
    
    public void removeConfigurationListener(ConfigurationListener listener) {
        listeners.remove(listener);
    }
    
    private void notifyListeners(String key, Object value) {
        for (ConfigurationListener listener : listeners) {
            try {
                listener.onConfigurationChanged(key, value);
            } catch (Exception e) {
                logger.error("Error notifying configuration listener", e);
            }
        }
    }
    
    // Settings dialog
    public void showSettingsDialog(JFrame parent) {
        SettingsDialog dialog = new SettingsDialog(parent, this);
        dialog.setVisible(true);
    }
}