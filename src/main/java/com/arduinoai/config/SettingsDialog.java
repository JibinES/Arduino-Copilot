package com.arduinoai.config;

import com.arduinoai.providers.AIProviderFactory;
import net.miginfocom.swing.MigLayout;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ItemEvent;
import java.util.HashMap;
import java.util.Map;

public class SettingsDialog extends JDialog {
    
    private final ConfigurationManager configManager;
    
    // Provider components
    private JComboBox<String> providerCombo;
    private JPanel providerConfigPanel;
    private CardLayout providerCardLayout;
    
    // Provider-specific fields
    private Map<String, JTextField> apiKeyFields;
    private Map<String, JComboBox<String>> modelCombos;
    private JTextField ollamaUrlField;
    
    // Completion settings
    private JCheckBox enableCompletionCheck;
    private JCheckBox autoTriggerCheck;
    private JSpinner delaySpinner;
    private JSpinner minCharsSpinner;
    private JSpinner maxTokensSpinner;
    private JSpinner temperatureSpinner;
    
    // Chat settings
    private JSpinner chatMaxTokensSpinner;
    private JSpinner chatHistorySizeSpinner;
    private JCheckBox includeContextCheck;
    
    public SettingsDialog(JFrame parent, ConfigurationManager configManager) {
        super(parent, "Arduino AI Copilot Settings", true);
        this.configManager = configManager;
        
        setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout());
        
        createComponents();
        loadSettings();
        
        pack();
        setLocationRelativeTo(parent);
    }
    
    private void createComponents() {
        JTabbedPane tabbedPane = new JTabbedPane();
        
        // AI Provider tab
        tabbedPane.addTab("AI Provider", createProviderPanel());
        
        // Code Completion tab
        tabbedPane.addTab("Code Completion", createCompletionPanel());
        
        // Chat tab
        tabbedPane.addTab("Chat", createChatPanel());
        
        // Keyboard Shortcuts tab
        tabbedPane.addTab("Keyboard Shortcuts", createShortcutsPanel());
        
        add(tabbedPane, BorderLayout.CENTER);
        
        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        
        JButton saveButton = new JButton("Save");
        saveButton.addActionListener(e -> saveSettings());
        
        JButton cancelButton = new JButton("Cancel");
        cancelButton.addActionListener(e -> dispose());
        
        JButton applyButton = new JButton("Apply");
        applyButton.addActionListener(e -> {
            saveSettings();
            // Don't close dialog
        });
        
        buttonPanel.add(saveButton);
        buttonPanel.add(cancelButton);
        buttonPanel.add(applyButton);
        
        add(buttonPanel, BorderLayout.SOUTH);
    }
    
    private JPanel createProviderPanel() {
        JPanel panel = new JPanel(new MigLayout("fill, insets 10"));
        
        // Provider selection
        panel.add(new JLabel("AI Provider:"), "right");
        providerCombo = new JComboBox<>(new String[]{
            "OpenAI", "Anthropic", "Ollama (Local)", "Google Gemini"
        });
        providerCombo.addItemListener(e -> {
            if (e.getStateChange() == ItemEvent.SELECTED) {
                updateProviderConfigPanel();
            }
        });
        panel.add(providerCombo, "wrap");
        
        // Provider-specific configuration
        panel.add(new JSeparator(), "span, growx, wrap, gaptop 10");
        
        providerCardLayout = new CardLayout();
        providerConfigPanel = new JPanel(providerCardLayout);
        
        apiKeyFields = new HashMap<>();
        modelCombos = new HashMap<>();
        
        // OpenAI panel
        providerConfigPanel.add(createOpenAIPanel(), "OpenAI");
        
        // Anthropic panel
        providerConfigPanel.add(createAnthropicPanel(), "Anthropic");
        
        // Ollama panel
        providerConfigPanel.add(createOllamaPanel(), "Ollama (Local)");
        
        // Gemini panel
        providerConfigPanel.add(createGeminiPanel(), "Google Gemini");
        
        panel.add(providerConfigPanel, "span, grow");
        
        return panel;
    }
    
    private JPanel createOpenAIPanel() {
        JPanel panel = new JPanel(new MigLayout("fill"));
        
        panel.add(new JLabel("API Key:"), "right");
        JTextField apiKeyField = new JPasswordField(30);
        apiKeyFields.put("openai", apiKeyField);
        panel.add(apiKeyField, "wrap");
        
        panel.add(new JLabel("Model:"), "right");
        JComboBox<String> modelCombo = new JComboBox<>(new String[]{
            "gpt-4", "gpt-4-turbo-preview", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"
        });
        modelCombos.put("openai", modelCombo);
        panel.add(modelCombo, "wrap");
        
        JButton testButton = new JButton("Test Connection");
        testButton.addActionListener(e -> testConnection("openai"));
        panel.add(testButton, "skip, wrap");
        
        panel.add(new JLabel("<html><i>Get your API key from " +
                             "<a href='https://platform.openai.com/api-keys'>OpenAI Platform</a></i></html>"),
                  "span, wrap");
        
        return panel;
    }
    
    private JPanel createAnthropicPanel() {
        JPanel panel = new JPanel(new MigLayout("fill"));
        
        panel.add(new JLabel("API Key:"), "right");
        JTextField apiKeyField = new JPasswordField(30);
        apiKeyFields.put("anthropic", apiKeyField);
        panel.add(apiKeyField, "wrap");
        
        panel.add(new JLabel("Model:"), "right");
        JComboBox<String> modelCombo = new JComboBox<>(new String[]{
            "claude-3-opus-20240229", "claude-3-sonnet-20240229", 
            "claude-3-haiku-20240307", "claude-2.1"
        });
        modelCombos.put("anthropic", modelCombo);
        panel.add(modelCombo, "wrap");
        
        JButton testButton = new JButton("Test Connection");
        testButton.addActionListener(e -> testConnection("anthropic"));
        panel.add(testButton, "skip, wrap");
        
        return panel;
    }
    
    private JPanel createOllamaPanel() {
        JPanel panel = new JPanel(new MigLayout("fill"));
        
        panel.add(new JLabel("Base URL:"), "right");
        ollamaUrlField = new JTextField("http://localhost:11434", 30);
        panel.add(ollamaUrlField, "wrap");
        
        panel.add(new JLabel("Model:"), "right");
        JComboBox<String> modelCombo = new JComboBox<>(new String[]{
            "codellama", "llama2", "mistral", "deepseek-coder"
        });
        modelCombo.setEditable(true);
        modelCombos.put("ollama", modelCombo);
        panel.add(modelCombo, "wrap");
        
        JButton refreshButton = new JButton("Refresh Models");
        refreshButton.addActionListener(e -> refreshOllamaModels());
        panel.add(refreshButton, "skip, split");
        
        JButton testButton = new JButton("Test Connection");
        testButton.addActionListener(e -> testConnection("ollama"));
        panel.add(testButton, "wrap");
        
        panel.add(new JLabel("<html><i>Ollama must be running locally. " +
                             "Download from <a href='https://ollama.ai'>ollama.ai</a></i></html>"),
                  "span, wrap");
        
        return panel;
    }
    
    private JPanel createGeminiPanel() {
        JPanel panel = new JPanel(new MigLayout("fill"));
        
        panel.add(new JLabel("API Key:"), "right");
        JTextField apiKeyField = new JPasswordField(30);
        apiKeyFields.put("gemini", apiKeyField);
        panel.add(apiKeyField, "wrap");
        
        panel.add(new JLabel("Model:"), "right");
        JComboBox<String> modelCombo = new JComboBox<>(new String[]{
            "gemini-pro", "gemini-pro-vision"
        });
        modelCombos.put("gemini", modelCombo);
        panel.add(modelCombo, "wrap");
        
        JButton testButton = new JButton("Test Connection");
        testButton.addActionListener(e -> testConnection("gemini"));
        panel.add(testButton, "skip, wrap");
        
        return panel;
    }
    
    private JPanel createCompletionPanel() {
        JPanel panel = new JPanel(new MigLayout("fill, insets 10"));
        
        enableCompletionCheck = new JCheckBox("Enable Code Completion");
        panel.add(enableCompletionCheck, "span, wrap");
        
        autoTriggerCheck = new JCheckBox("Auto-trigger Completion");
        panel.add(autoTriggerCheck, "gapleft 20, span, wrap");
        
        panel.add(new JLabel("Trigger Delay (ms):"), "gapleft 20, right");
        delaySpinner = new JSpinner(new SpinnerNumberModel(500, 100, 2000, 100));
        panel.add(delaySpinner, "wrap");
        
        panel.add(new JLabel("Minimum Characters:"), "gapleft 20, right");
        minCharsSpinner = new JSpinner(new SpinnerNumberModel(2, 1, 5, 1));
        panel.add(minCharsSpinner, "wrap");
        
        panel.add(new JLabel("Max Tokens:"), "right");
        maxTokensSpinner = new JSpinner(new SpinnerNumberModel(150, 50, 500, 50));
        panel.add(maxTokensSpinner, "wrap");
        
        panel.add(new JLabel("Temperature:"), "right");
        temperatureSpinner = new JSpinner(new SpinnerNumberModel(0.2, 0.0, 1.0, 0.1));
        panel.add(temperatureSpinner, "wrap");
        
        panel.add(new JLabel("<html><i>Lower temperature = more focused/deterministic<br>" +
                             "Higher temperature = more creative/random</i></html>"),
                  "span, gaptop 10");
        
        return panel;
    }
    
    private JPanel createChatPanel() {
        JPanel panel = new JPanel(new MigLayout("fill, insets 10"));
        
        panel.add(new JLabel("Max Response Tokens:"), "right");
        chatMaxTokensSpinner = new JSpinner(new SpinnerNumberModel(1000, 100, 4000, 100));
        panel.add(chatMaxTokensSpinner, "wrap");
        
        panel.add(new JLabel("History Size:"), "right");
        chatHistorySizeSpinner = new JSpinner(new SpinnerNumberModel(20, 5, 100, 5));
        panel.add(chatHistorySizeSpinner, "wrap");
        
        includeContextCheck = new JCheckBox("Include Current Sketch Context");
        panel.add(includeContextCheck, "span, wrap");
        
        panel.add(new JLabel("<html><i>Including context helps the AI understand your project<br>" +
                             "but uses more tokens</i></html>"),
                  "span, gaptop 10");
        
        return panel;
    }
    
    private JPanel createShortcutsPanel() {
        JPanel panel = new JPanel(new MigLayout("fill, insets 10"));
        
        panel.add(new JLabel("<html><b>Default Keyboard Shortcuts:</b></html>"), "span, wrap");
        
        String[][] shortcuts = {
            {"Ctrl+Space", "Trigger Code Completion"},
            {"Tab", "Accept Completion"},
            {"Esc", "Cancel Completion"},
            {"Ctrl+Shift+A", "Toggle AI Chat"},
            {"Ctrl+Shift+E", "Explain Selected Code"},
            {"Ctrl+Shift+S", "Open Settings"},
            {"Ctrl+Enter", "Send Chat Message (in chat)"}
        };
        
        for (String[] shortcut : shortcuts) {
            panel.add(new JLabel(shortcut[0]), "right, gapright 20");
            panel.add(new JLabel(shortcut[1]), "wrap");
        }
        
        panel.add(new JLabel("<html><i>Keyboard shortcuts cannot be customized yet</i></html>"),
                  "span, gaptop 20");
        
        return panel;
    }
    
    private void updateProviderConfigPanel() {
        String selected = (String) providerCombo.getSelectedItem();
        providerCardLayout.show(providerConfigPanel, selected);
    }
    
    private void loadSettings() {
        // Load provider
        String provider = configManager.getSelectedProvider();
        switch (provider) {
            case AIProviderFactory.PROVIDER_OPENAI:
                providerCombo.setSelectedItem("OpenAI");
                apiKeyFields.get("openai").setText(configManager.getOpenAIApiKey());
                modelCombos.get("openai").setSelectedItem(configManager.getOpenAIModel());
                break;
            case AIProviderFactory.PROVIDER_ANTHROPIC:
                providerCombo.setSelectedItem("Anthropic");
                apiKeyFields.get("anthropic").setText(configManager.getAnthropicApiKey());
                break;
            case AIProviderFactory.PROVIDER_OLLAMA:
                providerCombo.setSelectedItem("Ollama (Local)");
                ollamaUrlField.setText(configManager.getOllamaBaseUrl());
                modelCombos.get("ollama").setSelectedItem(configManager.getOllamaModel());
                break;
            case AIProviderFactory.PROVIDER_GEMINI:
                providerCombo.setSelectedItem("Google Gemini");
                break;
        }
        
        // Load completion settings
        enableCompletionCheck.setSelected(configManager.isAutoCompletionEnabled());
        autoTriggerCheck.setSelected(configManager.isAutoCompletionEnabled());
        delaySpinner.setValue(configManager.getCompletionDelay());
        minCharsSpinner.setValue(configManager.getMinCompletionChars());
        maxTokensSpinner.setValue(configManager.getMaxCompletionTokens());
        temperatureSpinner.setValue(configManager.getCompletionTemperature());
        
        // Load chat settings
        chatMaxTokensSpinner.setValue(configManager.getMaxChatTokens());
        chatHistorySizeSpinner.setValue(configManager.getChatHistorySize());
        includeContextCheck.setSelected(true); // Default to true
    }
    
    private void saveSettings() {
        // Save provider
        String selected = (String) providerCombo.getSelectedItem();
        switch (selected) {
            case "OpenAI":
                configManager.setSelectedProvider(AIProviderFactory.PROVIDER_OPENAI);
                configManager.setOpenAIApiKey(apiKeyFields.get("openai").getText());
                configManager.setOpenAIModel((String) modelCombos.get("openai").getSelectedItem());
                break;
            case "Anthropic":
                configManager.setSelectedProvider(AIProviderFactory.PROVIDER_ANTHROPIC);
                configManager.setAnthropicApiKey(apiKeyFields.get("anthropic").getText());
                break;
            case "Ollama (Local)":
                configManager.setSelectedProvider(AIProviderFactory.PROVIDER_OLLAMA);
                configManager.setOllamaBaseUrl(ollamaUrlField.getText());
                configManager.setOllamaModel((String) modelCombos.get("ollama").getSelectedItem());
                break;
            case "Google Gemini":
                configManager.setSelectedProvider(AIProviderFactory.PROVIDER_GEMINI);
                break;
        }
        
        // Save other settings (would need to add these methods to ConfigurationManager)
        configManager.saveConfiguration();
        
        JOptionPane.showMessageDialog(this, "Settings saved successfully!", 
                                      "Settings Saved", JOptionPane.INFORMATION_MESSAGE);
        dispose();
    }
    
    private void testConnection(String provider) {
        JOptionPane.showMessageDialog(this, 
            "Connection test for " + provider + " would be performed here",
            "Test Connection", 
            JOptionPane.INFORMATION_MESSAGE);
    }
    
    private void refreshOllamaModels() {
        // TODO: Implement Ollama model refresh
        JOptionPane.showMessageDialog(this, 
            "Refreshing Ollama models...",
            "Refresh Models", 
            JOptionPane.INFORMATION_MESSAGE);
    }
}