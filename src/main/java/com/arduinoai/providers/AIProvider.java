package com.arduinoai.providers;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface AIProvider {
    
    /**
     * Generate code completion based on context
     */
    CompletableFuture<CompletionResponse> generateCompletion(CompletionRequest request);
    
    /**
     * Send a chat message and get response
     */
    CompletableFuture<ChatResponse> sendChatMessage(ChatRequest request);
    
    /**
     * Check if the provider is available and configured
     */
    boolean isAvailable();
    
    /**
     * Get the provider name
     */
    String getName();
    
    /**
     * Get the current model being used
     */
    String getCurrentModel();
    
    /**
     * Get available models for this provider
     */
    List<String> getAvailableModels();
    
    /**
     * Set the model to use
     */
    void setModel(String model);
    
    /**
     * Test the connection and configuration
     */
    CompletableFuture<Boolean> testConnection();
    
    /**
     * Shutdown the provider and cleanup resources
     */
    void shutdown();
    
    // Request/Response classes
    
    class CompletionRequest {
        private final String code;
        private final String context;
        private final int cursorPosition;
        private final int maxTokens;
        private final double temperature;
        
        public CompletionRequest(String code, String context, int cursorPosition, 
                                 int maxTokens, double temperature) {
            this.code = code;
            this.context = context;
            this.cursorPosition = cursorPosition;
            this.maxTokens = maxTokens;
            this.temperature = temperature;
        }
        
        // Getters
        public String getCode() { return code; }
        public String getContext() { return context; }
        public int getCursorPosition() { return cursorPosition; }
        public int getMaxTokens() { return maxTokens; }
        public double getTemperature() { return temperature; }
    }
    
    class CompletionResponse {
        private final String completion;
        private final List<String> alternatives;
        private final double confidence;
        private final long responseTime;
        
        public CompletionResponse(String completion, List<String> alternatives, 
                                  double confidence, long responseTime) {
            this.completion = completion;
            this.alternatives = alternatives;
            this.confidence = confidence;
            this.responseTime = responseTime;
        }
        
        // Getters
        public String getCompletion() { return completion; }
        public List<String> getAlternatives() { return alternatives; }
        public double getConfidence() { return confidence; }
        public long getResponseTime() { return responseTime; }
    }
    
    class ChatRequest {
        private final String message;
        private final String context;
        private final List<ChatMessage> history;
        private final int maxTokens;
        
        public ChatRequest(String message, String context, List<ChatMessage> history, int maxTokens) {
            this.message = message;
            this.context = context;
            this.history = history;
            this.maxTokens = maxTokens;
        }
        
        // Getters
        public String getMessage() { return message; }
        public String getContext() { return context; }
        public List<ChatMessage> getHistory() { return history; }
        public int getMaxTokens() { return maxTokens; }
    }
    
    class ChatResponse {
        private final String response;
        private final long responseTime;
        private final int tokensUsed;
        
        public ChatResponse(String response, long responseTime, int tokensUsed) {
            this.response = response;
            this.responseTime = responseTime;
            this.tokensUsed = tokensUsed;
        }
        
        // Getters
        public String getResponse() { return response; }
        public long getResponseTime() { return responseTime; }
        public int getTokensUsed() { return tokensUsed; }
    }
    
    class ChatMessage {
        public enum Role { USER, ASSISTANT, SYSTEM }
        
        private final Role role;
        private final String content;
        
        public ChatMessage(Role role, String content) {
            this.role = role;
            this.content = content;
        }
        
        // Getters
        public Role getRole() { return role; }
        public String getContent() { return content; }
    }
}