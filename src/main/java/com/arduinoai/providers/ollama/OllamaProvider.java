package com.arduinoai.providers.ollama;

import com.arduinoai.config.ConfigurationManager;
import com.arduinoai.providers.AIProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public class OllamaProvider implements AIProvider {
    
    private static final Logger logger = LoggerFactory.getLogger(OllamaProvider.class);
    
    private final ConfigurationManager configManager;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private String currentModel = "codellama";
    private String baseUrl = "http://localhost:11434";
    private List<String> availableModels;
    
    public OllamaProvider(ConfigurationManager configManager) {
        this.configManager = configManager;
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .build();
        
        initialize();
    }
    
    private void initialize() {
        String configuredUrl = configManager.getOllamaBaseUrl();
        if (configuredUrl != null && !configuredUrl.isEmpty()) {
            baseUrl = configuredUrl;
        }
        
        String configuredModel = configManager.getOllamaModel();
        if (configuredModel != null && !configuredModel.isEmpty()) {
            currentModel = configuredModel;
        }
        
        // Load available models
        loadAvailableModels();
    }
    
    private void loadAvailableModels() {
        try {
            Request request = new Request.Builder()
                .url(baseUrl + "/api/tags")
                .get()
                .build();
            
            Response response = httpClient.newCall(request).execute();
            if (response.isSuccessful() && response.body() != null) {
                Map<String, Object> result = objectMapper.readValue(
                    response.body().string(), Map.class);
                
                List<Map<String, Object>> models = (List<Map<String, Object>>) result.get("models");
                availableModels = new ArrayList<>();
                
                for (Map<String, Object> model : models) {
                    String name = (String) model.get("name");
                    if (name != null) {
                        availableModels.add(name);
                    }
                }
                
                logger.info("Found {} Ollama models", availableModels.size());
            }
        } catch (Exception e) {
            logger.error("Failed to load Ollama models", e);
            availableModels = Arrays.asList("codellama", "llama2", "mistral");
        }
    }
    
    @Override
    public CompletableFuture<CompletionResponse> generateCompletion(CompletionRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            if (!isAvailable()) {
                throw new IllegalStateException("Ollama provider is not available");
            }
            
            long startTime = System.currentTimeMillis();
            
            try {
                String prompt = buildCompletionPrompt(request);
                
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", currentModel);
                requestBody.put("prompt", prompt);
                requestBody.put("stream", false);
                requestBody.put("options", Map.of(
                    "temperature", request.getTemperature(),
                    "num_predict", request.getMaxTokens()
                ));
                
                RequestBody body = RequestBody.create(
                    objectMapper.writeValueAsString(requestBody),
                    MediaType.parse("application/json")
                );
                
                Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/api/generate")
                    .post(body)
                    .build();
                
                Response response = httpClient.newCall(httpRequest).execute();
                
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> result = objectMapper.readValue(
                        response.body().string(), Map.class);
                    
                    String completion = (String) result.get("response");
                    long responseTime = System.currentTimeMillis() - startTime;
                    
                    // Extract just the code part if the model included explanations
                    completion = extractCodeFromResponse(completion);
                    
                    return new CompletionResponse(
                        completion, 
                        Collections.emptyList(), 
                        0.7, 
                        responseTime
                    );
                } else {
                    throw new IOException("Ollama request failed: " + response.code());
                }
                
            } catch (Exception e) {
                logger.error("Failed to generate completion", e);
                throw new RuntimeException("Completion generation failed", e);
            }
        });
    }
    
    @Override
    public CompletableFuture<ChatResponse> sendChatMessage(ChatRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            if (!isAvailable()) {
                throw new IllegalStateException("Ollama provider is not available");
            }
            
            long startTime = System.currentTimeMillis();
            
            try {
                List<Map<String, String>> messages = new ArrayList<>();
                
                // System message
                messages.add(Map.of(
                    "role", "system",
                    "content", "You are an expert Arduino assistant. Help users with Arduino programming, " +
                               "hardware connections, libraries, and troubleshooting. Provide clear, " +
                               "concise answers with code examples when appropriate."
                ));
                
                // Add context if available
                if (request.getContext() != null && !request.getContext().isEmpty()) {
                    messages.add(Map.of(
                        "role", "system",
                        "content", "Current sketch context:\n" + request.getContext()
                    ));
                }
                
                // Add chat history
                for (ChatMessage msg : request.getHistory()) {
                    messages.add(Map.of(
                        "role", msg.getRole() == ChatMessage.Role.USER ? "user" : "assistant",
                        "content", msg.getContent()
                    ));
                }
                
                // Add current message
                messages.add(Map.of(
                    "role", "user",
                    "content", request.getMessage()
                ));
                
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", currentModel);
                requestBody.put("messages", messages);
                requestBody.put("stream", false);
                
                RequestBody body = RequestBody.create(
                    objectMapper.writeValueAsString(requestBody),
                    MediaType.parse("application/json")
                );
                
                Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/api/chat")
                    .post(body)
                    .build();
                
                Response response = httpClient.newCall(httpRequest).execute();
                
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> result = objectMapper.readValue(
                        response.body().string(), Map.class);
                    
                    Map<String, Object> message = (Map<String, Object>) result.get("message");
                    String content = (String) message.get("content");
                    
                    long responseTime = System.currentTimeMillis() - startTime;
                    
                    return new ChatResponse(content, responseTime, 0);
                } else {
                    throw new IOException("Ollama request failed: " + response.code());
                }
                
            } catch (Exception e) {
                logger.error("Failed to send chat message", e);
                throw new RuntimeException("Chat message failed", e);
            }
        });
    }
    
    @Override
    public boolean isAvailable() {
        try {
            Request request = new Request.Builder()
                .url(baseUrl + "/api/tags")
                .get()
                .build();
            
            Response response = httpClient.newCall(request).execute();
            return response.isSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public String getName() {
        return "Ollama (Local)";
    }
    
    @Override
    public String getCurrentModel() {
        return currentModel;
    }
    
    @Override
    public List<String> getAvailableModels() {
        if (availableModels == null || availableModels.isEmpty()) {
            loadAvailableModels();
        }
        return new ArrayList<>(availableModels);
    }
    
    @Override
    public void setModel(String model) {
        this.currentModel = model;
        configManager.setOllamaModel(model);
    }
    
    @Override
    public CompletableFuture<Boolean> testConnection() {
        return CompletableFuture.supplyAsync(this::isAvailable);
    }
    
    @Override
    public void shutdown() {
        // Nothing to cleanup for HTTP client
    }
    
    private String buildCompletionPrompt(CompletionRequest request) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("You are completing Arduino code. ");
        prompt.append("Generate only the code to insert at the cursor position, no explanations.\n\n");
        
        // Add context
        if (request.getContext() != null && !request.getContext().isEmpty()) {
            prompt.append("Project context:\n");
            prompt.append(request.getContext()).append("\n\n");
        }
        
        // Add the code with cursor position marked
        String code = request.getCode();
        int cursorPos = request.getCursorPosition();
        
        if (cursorPos >= 0 && cursorPos <= code.length()) {
            prompt.append(code.substring(0, cursorPos));
            prompt.append("<INSERT_HERE>");
            prompt.append(code.substring(cursorPos));
        } else {
            prompt.append(code);
            prompt.append("<INSERT_HERE>");
        }
        
        prompt.append("\n\nComplete the code at <INSERT_HERE>:");
        
        return prompt.toString();
    }
    
    private String extractCodeFromResponse(String response) {
        // Try to extract just code if the model included explanations
        if (response.contains("```")) {
            int start = response.indexOf("```");
            int end = response.lastIndexOf("```");
            if (start != -1 && end != -1 && end > start) {
                String code = response.substring(start + 3, end).trim();
                // Remove language identifier if present
                if (code.startsWith("cpp") || code.startsWith("c++") || code.startsWith("arduino")) {
                    code = code.substring(code.indexOf('\n') + 1);
                }
                return code.trim();
            }
        }
        return response.trim();
    }
    
    public CompletableFuture<List<OllamaModel>> getDetailedModels() {
        return CompletableFuture.supplyAsync(() -> {
            List<OllamaModel> models = new ArrayList<>();
            
            try {
                Request request = new Request.Builder()
                    .url(baseUrl + "/api/tags")
                    .get()
                    .build();
                
                Response response = httpClient.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> result = objectMapper.readValue(
                        response.body().string(), Map.class);
                    
                    List<Map<String, Object>> modelList = (List<Map<String, Object>>) result.get("models");
                    
                    for (Map<String, Object> modelData : modelList) {
                        OllamaModel model = new OllamaModel();
                        model.name = (String) modelData.get("name");
                        model.size = (Long) modelData.get("size");
                        model.digest = (String) modelData.get("digest");
                        model.modifiedAt = (String) modelData.get("modified_at");
                        models.add(model);
                    }
                }
            } catch (Exception e) {
                logger.error("Failed to get detailed models", e);
            }
            
            return models;
        });
    }
    
    public static class OllamaModel {
        public String name;
        public Long size;
        public String digest;
        public String modifiedAt;
        
        public String getFormattedSize() {
            if (size == null) return "Unknown";
            double gb = size / (1024.0 * 1024.0 * 1024.0);
            return String.format("%.1f GB", gb);
        }
    }
}