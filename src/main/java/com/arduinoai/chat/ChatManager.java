package com.arduinoai.chat;

import com.arduinoai.core.PluginManager;
import com.arduinoai.config.ConfigurationManager;
import com.arduinoai.providers.AIProvider;
import com.arduinoai.providers.AIProvider.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;

public class ChatManager {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatManager.class);
    
    private final PluginManager pluginManager;
    private final ConfigurationManager configManager;
    private final List<ChatMessage> chatHistory;
    private final List<ChatListener> listeners;
    
    private AIProvider provider;
    private boolean isProcessing = false;
    
    public interface ChatListener {
        void onMessageSent(String message);
        void onResponseReceived(String response);
        void onError(String error);
        void onProcessingStateChanged(boolean isProcessing);
    }
    
    public ChatManager(PluginManager pluginManager, ConfigurationManager configManager) {
        this.pluginManager = pluginManager;
        this.configManager = configManager;
        this.chatHistory = new ArrayList<>();
        this.listeners = new CopyOnWriteArrayList<>();
        
        // Add system message for Arduino context
        chatHistory.add(new ChatMessage(
            ChatMessage.Role.SYSTEM,
            "You are an expert Arduino assistant integrated into Arduino IDE. " +
            "Help users with Arduino programming, hardware connections, libraries, and troubleshooting. " +
            "Provide clear, concise answers with code examples when appropriate. " +
            "You have access to the current sketch and project context."
        ));
    }
    
    public void setProvider(AIProvider provider) {
        this.provider = provider;
    }
    
    public void addListener(ChatListener listener) {
        listeners.add(listener);
    }
    
    public void removeListener(ChatListener listener) {
        listeners.remove(listener);
    }
    
    public void sendMessage(String message) {
        if (isProcessing || provider == null || !provider.isAvailable()) {
            notifyError("AI provider not available or busy");
            return;
        }
        
        isProcessing = true;
        notifyProcessingStateChanged(true);
        notifyMessageSent(message);
        
        // Add user message to history
        chatHistory.add(new ChatMessage(ChatMessage.Role.USER, message));
        
        // Get current context
        String projectContext = pluginManager.getProjectContext();
        String currentCode = pluginManager.getCurrentSketchCode();
        
        // Build context string
        StringBuilder context = new StringBuilder();
        if (!currentCode.isEmpty()) {
            context.append("Current sketch code:\n```cpp\n");
            context.append(currentCode);
            context.append("\n```\n\n");
        }
        if (!projectContext.isEmpty()) {
            context.append("Project context:\n");
            context.append(projectContext);
        }
        
        // Create chat request
        ChatRequest request = new ChatRequest(
            message,
            context.toString(),
            getRecentHistory(),
            configManager.getMaxChatTokens()
        );
        
        // Send request
        CompletableFuture<ChatResponse> future = provider.sendChatMessage(request);
        
        future.thenAccept(response -> {
            if (response != null) {
                // Add assistant response to history
                chatHistory.add(new ChatMessage(ChatMessage.Role.ASSISTANT, response.getResponse()));
                
                // Notify listeners
                notifyResponseReceived(response.getResponse());
                
                // Log token usage
                logger.info("Chat response received. Tokens used: {}, Response time: {}ms",
                            response.getTokensUsed(), response.getResponseTime());
            }
            
            isProcessing = false;
            notifyProcessingStateChanged(false);
            
        }).exceptionally(throwable -> {
            logger.error("Chat request failed", throwable);
            notifyError("Failed to get response: " + throwable.getMessage());
            
            isProcessing = false;
            notifyProcessingStateChanged(false);
            
            return null;
        });
    }
    
    public void explainCode(String code) {
        String message = String.format(
            "Please explain this Arduino code:\n```cpp\n%s\n```\n" +
            "Include what it does, how it works, and any potential improvements.",
            code
        );
        sendMessage(message);
    }
    
    public void suggestOptimization(String code) {
        String message = String.format(
            "Please suggest optimizations for this Arduino code:\n```cpp\n%s\n```\n" +
            "Consider performance, memory usage, and Arduino best practices.",
            code
        );
        sendMessage(message);
    }
    
    public void helpWithError(String error) {
        String message = String.format(
            "I'm getting this error in my Arduino sketch:\n```\n%s\n```\n" +
            "Can you help me understand what's wrong and how to fix it?",
            error
        );
        sendMessage(message);
    }
    
    public void askHardwareQuestion(String question) {
        sendMessage(question + "\nPlease consider Arduino hardware constraints and best practices.");
    }
    
    public List<ChatMessage> getChatHistory() {
        return new ArrayList<>(chatHistory);
    }
    
    public void clearHistory() {
        // Keep system message
        ChatMessage systemMessage = chatHistory.get(0);
        chatHistory.clear();
        chatHistory.add(systemMessage);
    }
    
    private List<ChatMessage> getRecentHistory() {
        // Return last N messages (excluding system message)
        int maxHistory = configManager.getChatHistorySize();
        int start = Math.max(1, chatHistory.size() - maxHistory);
        return new ArrayList<>(chatHistory.subList(start, chatHistory.size()));
    }
    
    private void notifyMessageSent(String message) {
        for (ChatListener listener : listeners) {
            try {
                listener.onMessageSent(message);
            } catch (Exception e) {
                logger.error("Error notifying listener", e);
            }
        }
    }
    
    private void notifyResponseReceived(String response) {
        for (ChatListener listener : listeners) {
            try {
                listener.onResponseReceived(response);
            } catch (Exception e) {
                logger.error("Error notifying listener", e);
            }
        }
    }
    
    private void notifyError(String error) {
        for (ChatListener listener : listeners) {
            try {
                listener.onError(error);
            } catch (Exception e) {
                logger.error("Error notifying listener", e);
            }
        }
    }
    
    private void notifyProcessingStateChanged(boolean isProcessing) {
        for (ChatListener listener : listeners) {
            try {
                listener.onProcessingStateChanged(isProcessing);
            } catch (Exception e) {
                logger.error("Error notifying listener", e);
            }
        }
    }
    
    public void shutdown() {
        listeners.clear();
        chatHistory.clear();
    }
    
    public boolean isProcessing() {
        return isProcessing;
    }
}