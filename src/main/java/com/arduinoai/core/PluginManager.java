package com.arduinoai.core;

import com.arduinoai.completion.CompletionEngine;
import com.arduinoai.chat.ChatManager;
import com.arduinoai.providers.AIProviderFactory;
import com.arduinoai.providers.AIProvider;
import com.arduinoai.config.ConfigurationManager;
import processing.app.Editor;
import processing.app.SketchCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.text.JTextComponent;
import java.awt.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class PluginManager {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginManager.class);
    
    private final Editor editor;
    private final ConfigurationManager configManager;
    private final ExecutorService executorService;
    private final AIProviderFactory providerFactory;
    
    private CompletionEngine completionEngine;
    private ChatManager chatManager;
    private AIProvider currentProvider;
    private DocumentListener documentListener;
    private JTextComponent editorTextArea;
    
    public PluginManager(Editor editor, ConfigurationManager configManager) {
        this.editor = editor;
        this.configManager = configManager;
        this.executorService = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "ArduinoCopilot-Worker");
            t.setDaemon(true);
            return t;
        });
        this.providerFactory = new AIProviderFactory(configManager);
    }
    
    public void initialize() {
        logger.info("Initializing PluginManager");
        
        // Initialize AI provider
        updateAIProvider();
        
        // Initialize completion engine
        completionEngine = new CompletionEngine(this, configManager);
        
        // Initialize chat manager
        chatManager = new ChatManager(this, configManager);
        
        // Attach to editor
        attachToEditor();
        
        // Listen for configuration changes
        configManager.addConfigurationListener(this::onConfigurationChanged);
    }
    
    private void attachToEditor() {
        SwingUtilities.invokeLater(() -> {
            try {
                // Find the text area component in the editor
                editorTextArea = findEditorTextArea(editor);
                
                if (editorTextArea != null) {
                    // Add document listener for code completion
                    documentListener = new DocumentListener() {
                        @Override
                        public void insertUpdate(DocumentEvent e) {
                            handleDocumentChange(e);
                        }
                        
                        @Override
                        public void removeUpdate(DocumentEvent e) {
                            handleDocumentChange(e);
                        }
                        
                        @Override
                        public void changedUpdate(DocumentEvent e) {
                            // Plain text components don't fire these events
                        }
                    };
                    
                    editorTextArea.getDocument().addDocumentListener(documentListener);
                    
                    // Add key bindings
                    setupKeyBindings();
                    
                    logger.info("Successfully attached to editor");
                } else {
                    logger.warn("Could not find editor text area");
                }
            } catch (Exception e) {
                logger.error("Failed to attach to editor", e);
            }
        });
    }
    
    private JTextComponent findEditorTextArea(Editor editor) {
        // Search for the text area component in the editor
        return findTextComponent(editor.getContentPane());
    }
    
    private JTextComponent findTextComponent(Container container) {
        for (Component comp : container.getComponents()) {
            if (comp instanceof JTextComponent) {
                return (JTextComponent) comp;
            } else if (comp instanceof Container) {
                JTextComponent found = findTextComponent((Container) comp);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }
    
    private void setupKeyBindings() {
        if (editorTextArea == null) return;
        
        InputMap inputMap = editorTextArea.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actionMap = editorTextArea.getActionMap();
        
        // Ctrl+Space for completion
        inputMap.put(KeyStroke.getKeyStroke("ctrl SPACE"), "triggerCompletion");
        actionMap.put("triggerCompletion", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                triggerCompletion();
            }
        });
        
        // Tab to accept completion
        inputMap.put(KeyStroke.getKeyStroke("TAB"), "acceptCompletion");
        actionMap.put("acceptCompletion", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (!completionEngine.acceptCompletion()) {
                    // If no completion to accept, do default tab behavior
                    editorTextArea.replaceSelection("\t");
                }
            }
        });
    }
    
    private void handleDocumentChange(DocumentEvent e) {
        if (configManager.isAutoCompletionEnabled()) {
            executorService.submit(() -> {
                try {
                    Thread.sleep(configManager.getCompletionDelay());
                    completionEngine.triggerAutoCompletion();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            });
        }
    }
    
    public void triggerCompletion() {
        executorService.submit(() -> completionEngine.triggerManualCompletion());
    }
    
    public void explainCode(String code) {
        executorService.submit(() -> chatManager.explainCode(code));
    }
    
    public void sendChatMessage(String message) {
        executorService.submit(() -> chatManager.sendMessage(message));
    }
    
    private void updateAIProvider() {
        String providerType = configManager.getSelectedProvider();
        currentProvider = providerFactory.createProvider(providerType);
        
        if (currentProvider == null) {
            logger.error("Failed to create AI provider: {}", providerType);
        } else {
            logger.info("Using AI provider: {}", providerType);
        }
    }
    
    private void onConfigurationChanged(String key, Object value) {
        if ("ai.provider".equals(key)) {
            updateAIProvider();
            if (completionEngine != null) {
                completionEngine.setProvider(currentProvider);
            }
            if (chatManager != null) {
                chatManager.setProvider(currentProvider);
            }
        }
    }
    
    public void shutdown() {
        logger.info("Shutting down PluginManager");
        
        // Remove document listener
        if (editorTextArea != null && documentListener != null) {
            editorTextArea.getDocument().removeDocumentListener(documentListener);
        }
        
        // Shutdown executor service
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        // Cleanup components
        if (completionEngine != null) {
            completionEngine.shutdown();
        }
        if (chatManager != null) {
            chatManager.shutdown();
        }
    }
    
    // Getters
    public Editor getEditor() {
        return editor;
    }
    
    public JTextComponent getEditorTextArea() {
        return editorTextArea;
    }
    
    public AIProvider getCurrentProvider() {
        return currentProvider;
    }
    
    public CompletionEngine getCompletionEngine() {
        return completionEngine;
    }
    
    public ChatManager getChatManager() {
        return chatManager;
    }
    
    public String getCurrentSketchCode() {
        if (editor.getSketch() != null && editor.getCurrentCode() != null) {
            return editor.getCurrentCode().getProgram();
        }
        return "";
    }
    
    public String getProjectContext() {
        StringBuilder context = new StringBuilder();
        
        if (editor.getSketch() != null) {
            context.append("// Sketch: ").append(editor.getSketch().getName()).append("\n");
            context.append("// Board: ").append(editor.getBoardName()).append("\n\n");
            
            for (SketchCode code : editor.getSketch().getCode()) {
                if (code != editor.getCurrentCode()) {
                    context.append("// File: ").append(code.getFileName()).append("\n");
                    context.append(code.getProgram()).append("\n\n");
                }
            }
        }
        
        return context.toString();
    }
}