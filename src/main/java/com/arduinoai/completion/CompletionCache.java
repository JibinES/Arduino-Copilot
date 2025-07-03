package com.arduinoai.completion;

import com.arduinoai.providers.AIProvider.CompletionResponse;

import java.util.LinkedHashMap;
import java.util.Map;

public class CompletionCache {
    
    private static final int MAX_CACHE_SIZE = 100;
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    
    private final Map<String, CacheEntry> cache;
    
    public CompletionCache() {
        this.cache = new LinkedHashMap<String, CacheEntry>(MAX_CACHE_SIZE, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                return size() > MAX_CACHE_SIZE;
            }
        };
    }
    
    public synchronized CompletionResponse get(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null) {
            if (System.currentTimeMillis() - entry.timestamp < CACHE_TTL_MS) {
                return entry.response;
            } else {
                cache.remove(key);
            }
        }
        return null;
    }
    
    public synchronized void put(String key, CompletionResponse response) {
        cache.put(key, new CacheEntry(response, System.currentTimeMillis()));
    }
    
    public synchronized void clear() {
        cache.clear();
    }
    
    private static class CacheEntry {
        final CompletionResponse response;
        final long timestamp;
        
        CacheEntry(CompletionResponse response, long timestamp) {
            this.response = response;
            this.timestamp = timestamp;
        }
    }
}