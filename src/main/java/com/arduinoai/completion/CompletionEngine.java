package com.arduinoai.completion;

import com.arduinoai.core.PluginManager;
import com.arduinoai.config.ConfigurationManager;
import com.arduinoai.providers.AIProvider;
import com.arduinoai.providers.AIProvider.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import javax.swing.text.BadLocationException;
import javax.swing.text.JTextComponent;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

public class CompletionEngine {
    
    private static final Logger logger = LoggerFactory.getLogger(CompletionEngine.class);
    
    private final PluginManager pluginManager;
    private final ConfigurationManager configManager;
    private final AtomicBoolean isProcessing = new AtomicBoolean(false);
    
    private AIProvider provider;
    private CompletionPopup currentPopup;
    private CompletionCache cache;
    private ArduinoContextAnalyzer contextAnalyzer;
    
    public CompletionEngine(PluginManager pluginManager, ConfigurationManager configManager) {
        this.pluginManager = pluginManager;
        this.configManager = configManager;
        this.cache = new CompletionCache();
        this.contextAnalyzer = new ArduinoContextAnalyzer();
    }
    
    public void setProvider(AIProvider provider) {
        this.provider = provider;
    }
    
    public void triggerAutoCompletion() {
        if (!configManager.isAutoCompletionEnabled() || isProcessing.get()) {
            return;
        }
        
        SwingUtilities.invokeLater(() -> {
            JTextComponent editor = pluginManager.getEditorTextArea();
            if (editor == null) return;
            
            try {
                int caretPos = editor.getCaretPosition();
                String text = editor.getText();
                
                // Check if we should trigger completion
                if (shouldTriggerCompletion(text, caretPos)) {
                    performCompletion(text, caretPos, false);
                }
            } catch (Exception e) {
                logger.error("Error in auto completion", e);
            }
        });
    }
    
    public void triggerManualCompletion() {
        if (isProcessing.get()) {
            return;
        }
        
        SwingUtilities.invokeLater(() -> {
            JTextComponent editor = pluginManager.getEditorTextArea();
            if (editor == null) return;
            
            try {
                int caretPos = editor.getCaretPosition();
                String text = editor.getText();
                performCompletion(text, caretPos, true);
            } catch (Exception e) {
                logger.error("Error in manual completion", e);
            }
        });
    }
    
    private void performCompletion(String text, int caretPos, boolean isManual) {
        if (provider == null || !provider.isAvailable()) {
            logger.warn("AI provider not available for completion");
            return;
        }
        
        isProcessing.set(true);
        
        // Get context
        String projectContext = pluginManager.getProjectContext();
        CompletionContext context = contextAnalyzer.analyzeContext(text, caretPos);
        
        // Check cache first
        String cacheKey = context.generateCacheKey();
        CompletionResponse cached = cache.get(cacheKey);
        if (cached != null && !isManual) {
            showCompletionPopup(cached, caretPos);
            isProcessing.set(false);
            return;
        }
        
        // Build completion request
        CompletionRequest request = new CompletionRequest(
            text,
            projectContext,
            caretPos,
            configManager.getMaxCompletionTokens(),
            configManager.getCompletionTemperature()
        );
        
        // Show loading indicator
        if (isManual) {
            showLoadingIndicator(caretPos);
        }
        
        // Request completion
        CompletableFuture<CompletionResponse> future = provider.generateCompletion(request);
        
        future.thenAccept(response -> {
            SwingUtilities.invokeLater(() -> {
                hideLoadingIndicator();
                
                if (response != null && !response.getCompletion().isEmpty()) {
                    // Filter Arduino-specific completions
                    response = filterArduinoCompletions(response, context);
                    
                    // Cache the response
                    cache.put(cacheKey, response);
                    
                    // Show popup
                    showCompletionPopup(response, caretPos);
                }
                
                isProcessing.set(false);
            });
        }).exceptionally(throwable -> {
            logger.error("Completion request failed", throwable);
            SwingUtilities.invokeLater(() -> {
                hideLoadingIndicator();
                isProcessing.set(false);
            });
            return null;
        });
    }
    
    private boolean shouldTriggerCompletion(String text, int caretPos) {
        if (caretPos < 1) return false;
        
        try {
            // Get the character before cursor
            char prevChar = text.charAt(caretPos - 1);
            
            // Trigger on common Arduino patterns
            if (prevChar == '.') return true; // Member access
            if (prevChar == '(') return true; // Function call
            if (prevChar == '<') return true; // Template or include
            if (prevChar == ':' && caretPos > 1 && text.charAt(caretPos - 2) == ':') return true; // Scope
            
            // Check for Arduino-specific triggers
            String line = getLineAtCaret(text, caretPos);
            if (line.trim().startsWith("#include")) return true;
            if (line.contains("pinMode") || line.contains("digitalWrite") || 
                line.contains("analogRead") || line.contains("Serial.")) return true;
            
            // Check if we're at the end of a word
            if (Character.isLetterOrDigit(prevChar)) {
                String word = getWordAtCaret(text, caretPos);
                return word.length() >= configManager.getMinCompletionChars();
            }
            
        } catch (Exception e) {
            logger.debug("Error checking completion trigger", e);
        }
        
        return false;
    }
    
    private void showCompletionPopup(CompletionResponse response, int caretPos) {
        JTextComponent editor = pluginManager.getEditorTextArea();
        if (editor == null) return;
        
        // Hide existing popup
        hideCompletionPopup();
        
        // Create new popup
        currentPopup = new CompletionPopup(editor, response, caretPos);
        currentPopup.show();
    }
    
    private void hideCompletionPopup() {
        if (currentPopup != null) {
            currentPopup.hide();
            currentPopup = null;
        }
    }
    
    public boolean acceptCompletion() {
        if (currentPopup != null && currentPopup.isVisible()) {
            currentPopup.acceptSelected();
            return true;
        }
        return false;
    }
    
    private void showLoadingIndicator(int caretPos) {
        // TODO: Implement loading indicator
    }
    
    private void hideLoadingIndicator() {
        // TODO: Implement loading indicator removal
    }
    
    private CompletionResponse filterArduinoCompletions(CompletionResponse response, 
                                                        CompletionContext context) {
        // Apply Arduino-specific filtering and enhancement
        String completion = response.getCompletion();
        
        // Add Arduino-specific enhancements
        if (context.isInPinMode()) {
            completion = enhancePinModeCompletion(completion);
        } else if (context.isInSerialFunction()) {
            completion = enhanceSerialCompletion(completion);
        }
        
        return new CompletionResponse(
            completion,
            response.getAlternatives(),
            response.getConfidence(),
            response.getResponseTime()
        );
    }
    
    private String enhancePinModeCompletion(String completion) {
        // Add helpful comments for pin modes
        if (completion.contains("OUTPUT") && !completion.contains("//")) {
            completion += " // Set pin as output";
        } else if (completion.contains("INPUT") && !completion.contains("//")) {
            completion += " // Set pin as input";
        }
        return completion;
    }
    
    private String enhanceSerialCompletion(String completion) {
        // Add baud rate suggestions for Serial.begin
        if (completion.contains("begin(") && !completion.contains("9600")) {
            completion = completion.replace("begin(", "begin(9600");
        }
        return completion;
    }
    
    private String getLineAtCaret(String text, int caretPos) {
        int start = text.lastIndexOf('\n', caretPos - 1) + 1;
        int end = text.indexOf('\n', caretPos);
        if (end == -1) end = text.length();
        return text.substring(start, end);
    }
    
    private String getWordAtCaret(String text, int caretPos) {
        int start = caretPos;
        int end = caretPos;
        
        // Find word start
        while (start > 0 && Character.isLetterOrDigit(text.charAt(start - 1))) {
            start--;
        }
        
        // Find word end
        while (end < text.length() && Character.isLetterOrDigit(text.charAt(end))) {
            end++;
        }
        
        return text.substring(start, end);
    }
    
    public void shutdown() {
        hideCompletionPopup();
        cache.clear();
    }
    
    // Inner classes
    
    private static class CompletionContext {
        private final String linePrefix;
        private final String lineSuffix;
        private final String currentWord;
        private final int indentLevel;
        private final boolean inFunction;
        private final boolean inComment;
        
        public CompletionContext(String linePrefix, String lineSuffix, String currentWord,
                                 int indentLevel, boolean inFunction, boolean inComment) {
            this.linePrefix = linePrefix;
            this.lineSuffix = lineSuffix;
            this.currentWord = currentWord;
            this.indentLevel = indentLevel;
            this.inFunction = inFunction;
            this.inComment = inComment;
        }
        
        public String generateCacheKey() {
            return linePrefix.trim() + "|" + currentWord;
        }
        
        public boolean isInPinMode() {
            return linePrefix.contains("pinMode");
        }
        
        public boolean isInSerialFunction() {
            return linePrefix.contains("Serial.");
        }
    }
    
    private static class ArduinoContextAnalyzer {
        public CompletionContext analyzeContext(String text, int caretPos) {
            String line = getLineAt(text, caretPos);
            int lineStart = text.lastIndexOf('\n', caretPos - 1) + 1;
            int posInLine = caretPos - lineStart;
            
            String linePrefix = line.substring(0, Math.min(posInLine, line.length()));
            String lineSuffix = posInLine < line.length() ? line.substring(posInLine) : "";
            
            // Extract current word
            String currentWord = extractCurrentWord(text, caretPos);
            
            // Calculate indent
            int indentLevel = calculateIndent(linePrefix);
            
            // Check context
            boolean inFunction = isInFunction(text, caretPos);
            boolean inComment = isInComment(text, caretPos);
            
            return new CompletionContext(linePrefix, lineSuffix, currentWord,
                                         indentLevel, inFunction, inComment);
        }
        
        private String getLineAt(String text, int pos) {
            int start = text.lastIndexOf('\n', pos - 1) + 1;
            int end = text.indexOf('\n', pos);
            if (end == -1) end = text.length();
            return text.substring(start, end);
        }
        
        private String extractCurrentWord(String text, int pos) {
            int start = pos;
            while (start > 0 && Character.isJavaIdentifierPart(text.charAt(start - 1))) {
                start--;
            }
            return text.substring(start, pos);
        }
        
        private int calculateIndent(String linePrefix) {
            int spaces = 0;
            for (char c : linePrefix.toCharArray()) {
                if (c == ' ') spaces++;
                else if (c == '\t') spaces += 4;
                else break;
            }
            return spaces / 2; // Assuming 2-space indent
        }
        
        private boolean isInFunction(String text, int pos) {
            // Simple heuristic: count braces
            int braceCount = 0;
            for (int i = 0; i < pos && i < text.length(); i++) {
                if (text.charAt(i) == '{') braceCount++;
                else if (text.charAt(i) == '}') braceCount--;
            }
            return braceCount > 0;
        }
        
        private boolean isInComment(String text, int pos) {
            // Check for line comment
            int lineStart = text.lastIndexOf('\n', pos - 1) + 1;
            String line = text.substring(lineStart, pos);
            if (line.contains("//")) {
                return line.lastIndexOf("//") < pos - lineStart;
            }
            
            // Check for block comment
            int lastBlockStart = text.lastIndexOf("/*", pos);
            int lastBlockEnd = text.lastIndexOf("*/", pos);
            
            return lastBlockStart > lastBlockEnd;
        }
    }
}