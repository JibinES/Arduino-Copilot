package com.arduinoai.arduino;

import java.util.*;

public class ArduinoLibraryManager {
    
    private static final Map<String, LibraryInfo> COMMON_LIBRARIES = new HashMap<>();
    
    static {
        // Initialize common Arduino libraries
        COMMON_LIBRARIES.put("servo", new LibraryInfo(
            "Servo", 
            "#include <Servo.h>",
            "Control servo motors",
            Arrays.asList("Servo myservo;", "myservo.attach(9);", "myservo.write(90);")
        ));
        
        COMMON_LIBRARIES.put("wire", new LibraryInfo(
            "Wire", 
            "#include <Wire.h>",
            "I2C communication",
            Arrays.asList("Wire.begin();", "Wire.requestFrom(address, 6);")
        ));
        
        COMMON_LIBRARIES.put("spi", new LibraryInfo(
            "SPI", 
            "#include <SPI.h>",
            "SPI communication",
            Arrays.asList("SPI.begin();", "SPI.transfer(data);")
        ));
        
        COMMON_LIBRARIES.put("liquidcrystal", new LibraryInfo(
            "LiquidCrystal", 
            "#include <LiquidCrystal.h>",
            "Control LCD displays",
            Arrays.asList("LiquidCrystal lcd(12, 11, 5, 4, 3, 2);", "lcd.begin(16, 2);", "lcd.print(\"Hello\");")
        ));
        
        COMMON_LIBRARIES.put("dht", new LibraryInfo(
            "DHT", 
            "#include <DHT.h>",
            "Read DHT temperature/humidity sensors",
            Arrays.asList("DHT dht(2, DHT22);", "dht.begin();", "float temp = dht.readTemperature();")
        ));
        
        COMMON_LIBRARIES.put("adafruit_neopixel", new LibraryInfo(
            "Adafruit_NeoPixel", 
            "#include <Adafruit_NeoPixel.h>",
            "Control NeoPixel LED strips",
            Arrays.asList("Adafruit_NeoPixel pixels(60, 6, NEO_GRB + NEO_KHZ800);", 
                          "pixels.begin();", 
                          "pixels.setPixelColor(i, pixels.Color(r, g, b));")
        ));
    }
    
    public static List<LibraryInfo> suggestLibrariesForTask(String task) {
        List<LibraryInfo> suggestions = new ArrayList<>();
        String taskLower = task.toLowerCase();
        
        if (taskLower.contains("servo") || taskLower.contains("motor")) {
            suggestions.add(COMMON_LIBRARIES.get("servo"));
        }
        
        if (taskLower.contains("lcd") || taskLower.contains("display") || taskLower.contains("screen")) {
            suggestions.add(COMMON_LIBRARIES.get("liquidcrystal"));
        }
        
        if (taskLower.contains("i2c") || taskLower.contains("wire")) {
            suggestions.add(COMMON_LIBRARIES.get("wire"));
        }
        
        if (taskLower.contains("spi")) {
            suggestions.add(COMMON_LIBRARIES.get("spi"));
        }
        
        if (taskLower.contains("temperature") || taskLower.contains("humidity") || taskLower.contains("dht")) {
            suggestions.add(COMMON_LIBRARIES.get("dht"));
        }
        
        if (taskLower.contains("led") || taskLower.contains("neopixel") || taskLower.contains("rgb")) {
            suggestions.add(COMMON_LIBRARIES.get("adafruit_neopixel"));
        }
        
        return suggestions;
    }
    
    public static class LibraryInfo {
        private final String name;
        private final String includeStatement;
        private final String description;
        private final List<String> exampleCode;
        
        public LibraryInfo(String name, String includeStatement, String description, List<String> exampleCode) {
            this.name = name;
            this.includeStatement = includeStatement;
            this.description = description;
            this.exampleCode = exampleCode;
        }
        
        public String getName() { return name; }
        public String getIncludeStatement() { return includeStatement; }
        public String getDescription() { return description; }
        public List<String> getExampleCode() { return exampleCode; }
    }
}