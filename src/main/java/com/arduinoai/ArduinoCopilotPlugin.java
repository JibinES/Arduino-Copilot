package com.arduinoai;

import com.arduinoai.core.PluginManager;
import com.arduinoai.ui.CopilotToolWindow;
import com.arduinoai.config.ConfigurationManager;
import processing.app.Editor;
import processing.app.tools.Tool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.awt.event.ActionEvent;

public class ArduinoCopilotPlugin implements Tool {
    
    private static final Logger logger = LoggerFactory.getLogger(ArduinoCopilotPlugin.class);
    private static final String PLUGIN_NAME = "Arduino AI Copilot";
    private static final String VERSION = "1.0.0";
    
    private Editor editor;
    private PluginManager pluginManager;
    private CopilotToolWindow toolWindow;
    private ConfigurationManager configManager;
    
    @Override
    public void init(Editor editor) {
        this.editor = editor;
        logger.info("Initializing {} v{}", PLUGIN_NAME, VERSION);
        
        try {
            // Initialize configuration manager
            configManager = ConfigurationManager.getInstance();
            configManager.loadConfiguration();
            
            // Initialize plugin manager
            pluginManager = new PluginManager(editor, configManager);
            pluginManager.initialize();
            
            // Add menu items
            setupMenuItems();
            
            // Initialize tool window (chat panel)
            toolWindow = new CopilotToolWindow(editor, pluginManager);
            
            logger.info("{} initialized successfully", PLUGIN_NAME);
        } catch (Exception e) {
            logger.error("Failed to initialize plugin", e);
            showErrorDialog("Failed to initialize Arduino AI Copilot: " + e.getMessage());
        }
    }
    
    @Override
    public void run() {
        SwingUtilities.invokeLater(() -> {
            if (toolWindow != null) {
                toolWindow.setVisible(!toolWindow.isVisible());
            }
        });
    }
    
    @Override
    public String getMenuTitle() {
        return PLUGIN_NAME;
    }
    
    private void setupMenuItems() {
        JMenuBar menuBar = editor.getJMenuBar();
        
        // Find or create AI menu
        JMenu aiMenu = null;
        for (int i = 0; i < menuBar.getMenuCount(); i++) {
            JMenu menu = menuBar.getMenu(i);
            if (menu != null && "AI".equals(menu.getText())) {
                aiMenu = menu;
                break;
            }
        }
        
        if (aiMenu == null) {
            aiMenu = new JMenu("AI");
            menuBar.add(aiMenu, menuBar.getMenuCount() - 1); // Add before Help menu
        }
        
        // Add menu items
        JMenuItem toggleChatItem = new JMenuItem("Toggle AI Chat");
        toggleChatItem.setAccelerator(KeyStroke.getKeyStroke("ctrl shift A"));
        toggleChatItem.addActionListener(e -> run());
        
        JMenuItem settingsItem = new JMenuItem("AI Settings...");
        settingsItem.setAccelerator(KeyStroke.getKeyStroke("ctrl shift S"));
        settingsItem.addActionListener(e -> showSettings());
        
        JMenuItem completeCodeItem = new JMenuItem("Complete Code");
        completeCodeItem.setAccelerator(KeyStroke.getKeyStroke("ctrl SPACE"));
        completeCodeItem.addActionListener(e -> triggerCodeCompletion());
        
        JMenuItem explainCodeItem = new JMenuItem("Explain Code");
        explainCodeItem.setAccelerator(KeyStroke.getKeyStroke("ctrl shift E"));
        explainCodeItem.addActionListener(e -> explainSelectedCode());
        
        aiMenu.add(toggleChatItem);
        aiMenu.add(completeCodeItem);
        aiMenu.add(explainCodeItem);
        aiMenu.addSeparator();
        aiMenu.add(settingsItem);
    }
    
    private void showSettings() {
        SwingUtilities.invokeLater(() -> {
            configManager.showSettingsDialog(editor);
        });
    }
    
    private void triggerCodeCompletion() {
        if (pluginManager != null) {
            pluginManager.triggerCompletion();
        }
    }
    
    private void explainSelectedCode() {
        if (pluginManager != null) {
            String selectedText = editor.getSelectedText();
            if (selectedText != null && !selectedText.isEmpty()) {
                pluginManager.explainCode(selectedText);
            }
        }
    }
    
    private void showErrorDialog(String message) {
        SwingUtilities.invokeLater(() -> {
            JOptionPane.showMessageDialog(editor, message, "Arduino AI Copilot Error", 
                                          JOptionPane.ERROR_MESSAGE);
        });
    }
    
    public void shutdown() {
        logger.info("Shutting down {}", PLUGIN_NAME);
        if (pluginManager != null) {
            pluginManager.shutdown();
        }
        if (toolWindow != null) {
            toolWindow.dispose();
        }
    }
}