package com.arduinoai.providers.openai;

import com.arduinoai.config.ConfigurationManager;
import com.arduinoai.providers.AIProvider;
import com.theokanning.openai.completion.chat.*;
import com.theokanning.openai.service.OpenAiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public class OpenAIProvider implements AIProvider {
    
    private static final Logger logger = LoggerFactory.getLogger(OpenAIProvider.class);
    
    private final ConfigurationManager configManager;
    private OpenAiService service;
    private String currentModel = "gpt-3.5-turbo";
    
    private static final List<String> AVAILABLE_MODELS = Arrays.asList(
        "gpt-4",
        "gpt-4-turbo-preview",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k"
    );
    
    public OpenAIProvider(ConfigurationManager configManager) {
        this.configManager = configManager;
        initialize();
    }
    
    private void initialize() {
        String apiKey = configManager.getOpenAIApiKey();
        if (apiKey != null && !apiKey.isEmpty()) {
            try {
                service = new OpenAiService(apiKey, Duration.ofSeconds(30));
                String savedModel = configManager.getOpenAIModel();
                if (savedModel != null && AVAILABLE_MODELS.contains(savedModel)) {
                    currentModel = savedModel;
                }
                logger.info("OpenAI provider initialized with model: {}", currentModel);
            } catch (Exception e) {
                logger.error("Failed to initialize OpenAI service", e);
            }
        }
    }
    
    @Override
    public CompletableFuture<CompletionResponse> generateCompletion(CompletionRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            if (!isAvailable()) {
                throw new IllegalStateException("OpenAI provider is not available");
            }
            
            long startTime = System.currentTimeMillis();
            
            try {
                String prompt = buildCompletionPrompt(request);
                
                List<ChatMessage> messages = new ArrayList<>();
                messages.add(new ChatMessage(ChatMessageRole.SYSTEM.value(), 
                    "You are an expert Arduino programmer. Generate code completions for Arduino sketches. " +
                    "Consider Arduino-specific syntax, libraries, and hardware constraints."));
                messages.add(new ChatMessage(ChatMessageRole.USER.value(), prompt));
                
                ChatCompletionRequest completionRequest = ChatCompletionRequest.builder()
                    .model(currentModel)
                    .messages(messages)
                    .maxTokens(request.getMaxTokens())
                    .temperature(request.getTemperature())
                    .n(3) // Generate 3 alternatives
                    .build();
                
                ChatCompletionResult result = service.createChatCompletion(completionRequest);
                
                List<String> completions = result.getChoices().stream()
                    .map(choice -> choice.getMessage().getContent())
                    .collect(Collectors.toList());
                
                String mainCompletion = completions.isEmpty() ? "" : completions.get(0);
                List<String> alternatives = completions.size() > 1 ? 
                    completions.subList(1, completions.size()) : Collections.emptyList();
                
                long responseTime = System.currentTimeMillis() - startTime;
                
                return new CompletionResponse(mainCompletion, alternatives, 0.8, responseTime);
                
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
                throw new IllegalStateException("OpenAI provider is not available");
            }
            
            long startTime = System.currentTimeMillis();
            
            try {
                List<ChatMessage> messages = new ArrayList<>();
                
                // System message
                messages.add(new ChatMessage(ChatMessageRole.SYSTEM.value(),
                    "You are an expert Arduino assistant. Help users with Arduino programming, " +
                    "hardware connections, libraries, and troubleshooting. Provide clear, " +
                    "concise answers with code examples when appropriate."));
                
                // Add context if available
                if (request.getContext() != null && !request.getContext().isEmpty()) {
                    messages.add(new ChatMessage(ChatMessageRole.SYSTEM.value(),
                        "Current sketch context:\n" + request.getContext()));
                }
                
                // Add chat history
                for (AIProvider.ChatMessage msg : request.getHistory()) {
                    String role = msg.getRole() == AIProvider.ChatMessage.Role.USER ? 
                        ChatMessageRole.USER.value() : ChatMessageRole.ASSISTANT.value();
                    messages.add(new ChatMessage(role, msg.getContent()));
                }
                
                // Add current message
                messages.add(new ChatMessage(ChatMessageRole.USER.value(), request.getMessage()));
                
                ChatCompletionRequest chatRequest = ChatCompletionRequest.builder()
                    .model(currentModel)
                    .messages(messages)
                    .maxTokens(request.getMaxTokens())
                    .temperature(0.7)
                    .build();
                
                ChatCompletionResult result = service.createChatCompletion(chatRequest);
                
                String response = result.getChoices().get(0).getMessage().getContent();
                int tokensUsed = result.getUsage().getTotalTokens();
                long responseTime = System.currentTimeMillis() - startTime;
                
                return new ChatResponse(response, responseTime, tokensUsed);
                
            } catch (Exception e) {
                logger.error("Failed to send chat message", e);
                throw new RuntimeException("Chat message failed", e);
            }
        });
    }
    
    @Override
    public boolean isAvailable() {
        return service != null && configManager.getOpenAIApiKey() != null;
    }
    
    @Override
    public String getName() {
        return "OpenAI";
    }
    
    @Override
    public String getCurrentModel() {
        return currentModel;
    }
    
    @Override
    public List<String> getAvailableModels() {
        return new ArrayList<>(AVAILABLE_MODELS);
    }
    
    @Override
    public void setModel(String model) {
        if (AVAILABLE_MODELS.contains(model)) {
            this.currentModel = model;
            configManager.setOpenAIModel(model);
        }
    }
    
    @Override
    public CompletableFuture<Boolean> testConnection() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                ChatCompletionRequest testRequest = ChatCompletionRequest.builder()
                    .model(currentModel)
                    .messages(Collections.singletonList(
                        new ChatMessage(ChatMessageRole.USER.value(), "Test connection")))
                    .maxTokens(10)
                    .build();
                
                service.createChatCompletion(testRequest);
                return true;
            } catch (Exception e) {
                logger.error("Connection test failed", e);
                return false;
            }
        });
    }
    
    @Override
    public void shutdown() {
        if (service != null) {
            service.shutdownExecutor();
        }
    }
    
    private String buildCompletionPrompt(CompletionRequest request) {
        StringBuilder prompt = new StringBuilder();
        
        // Add context
        if (request.getContext() != null && !request.getContext().isEmpty()) {
            prompt.append("// Project context:\n");
            prompt.append(request.getContext()).append("\n\n");
        }
        
        // Add the code with cursor position marked
        String code = request.getCode();
        int cursorPos = request.getCursorPosition();
        
        if (cursorPos >= 0 && cursorPos <= code.length()) {
            prompt.append(code.substring(0, cursorPos));
            prompt.append("<CURSOR>");
            prompt.append(code.substring(cursorPos));
        } else {
            prompt.append(code);
            prompt.append("<CURSOR>");
        }
        
        prompt.append("\n\nGenerate Arduino code completion at <CURSOR> position. ");
        prompt.append("Return only the code to insert, no explanations.");
        
        return prompt.toString();
    }
}