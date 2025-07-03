package com.arduinoai.providers;

import com.arduinoai.config.ConfigurationManager;
import com.arduinoai.providers.openai.OpenAIProvider;
import com.arduinoai.providers.anthropic.AnthropicProvider;
import com.arduinoai.providers.ollama.OllamaProvider;
import com.arduinoai.providers.gemini.GeminiProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

public class AIProviderFactory {
    
    private static final Logger logger = LoggerFactory.getLogger(AIProviderFactory.class);
    
    public static final String PROVIDER_OPENAI = "openai";
    public static final String PROVIDER_ANTHROPIC = "anthropic";
    public static final String PROVIDER_OLLAMA = "ollama";
    public static final String PROVIDER_GEMINI = "gemini";
    
    private final ConfigurationManager configManager;
    private final Map<String, AIProvider> providerCache;
    
    public AIProviderFactory(ConfigurationManager configManager) {
        this.configManager = configManager;
        this.providerCache = new HashMap<>();
    }
    
    public AIProvider createProvider(String providerType) {
        if (providerType == null || providerType.isEmpty()) {
            logger.error("Provider type is null or empty");
            return null;
        }
        
        // Check cache first
        AIProvider cached = providerCache.get(providerType);
        if (cached != null && cached.isAvailable()) {
            return cached;
        }
        
        AIProvider provider = null;
        
        try {
            switch (providerType.toLowerCase()) {
                case PROVIDER_OPENAI:
                    provider = new OpenAIProvider(configManager);
                    break;
                    
                case PROVIDER_ANTHROPIC:
                    provider = new AnthropicProvider(configManager);
                    break;
                    
                case PROVIDER_OLLAMA:
                    provider = new OllamaProvider(configManager);
                    break;
                    
                case PROVIDER_GEMINI:
                    provider = new GeminiProvider(configManager);
                    break;
                    
                default:
                    logger.error("Unknown provider type: {}", providerType);
                    return null;
            }
            
            if (provider != null && provider.isAvailable()) {
                providerCache.put(providerType, provider);
                logger.info("Created provider: {}", provider.getName());
            } else {
                logger.warn("Provider {} is not available", providerType);
            }
            
        } catch (Exception e) {
            logger.error("Failed to create provider: {}", providerType, e);
        }
        
        return provider;
    }
    
    public void shutdownAll() {
        logger.info("Shutting down all AI providers");
        providerCache.values().forEach(AIProvider::shutdown);
        providerCache.clear();
    }
}