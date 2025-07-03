package com.arduinoai.arduino;

import java.util.*;

public class ArduinoPinManager {
    
    private static final Map<String, BoardPinConfiguration> BOARD_CONFIGS = new HashMap<>();
    
    static {
        // Arduino Uno configuration
        BOARD_CONFIGS.put("Arduino Uno", new BoardPinConfiguration(
            Arrays.asList(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13),
            Arrays.asList(0, 1, 2, 3, 4, 5),
            Arrays.asList(3, 5, 6, 9, 10, 11),
            Arrays.asList(10, 11, 12, 13), // SPI
            Arrays.asList(4, 5), // I2C (A4=SDA, A5=SCL)
            Arrays.asList(0, 1), // Serial
            Arrays.asList(2, 3) // External interrupts
        ));
        
        // Arduino Mega configuration
        BOARD_CONFIGS.put("Arduino Mega", new BoardPinConfiguration(
            Arrays.asList(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 
                          14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 
                          26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 
                          38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 
                          50, 51, 52, 53),
            Arrays.asList(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
            Arrays.asList(2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46),
            Arrays.asList(50, 51, 52, 53), // SPI
            Arrays.asList(20, 21), // I2C
            Arrays.asList(0, 1, 14, 15, 16, 17, 18, 19), // Serial 0-3
            Arrays.asList(2, 3, 18, 19, 20, 21) // External interrupts
        ));
    }
    
    public static PinSuggestion suggestPinsForComponent(String boardName, String component) {
        BoardPinConfiguration board = BOARD_CONFIGS.get(boardName);
        if (board == null) {
            board = BOARD_CONFIGS.get("Arduino Uno"); // Default to Uno
        }
        
        PinSuggestion suggestion = new PinSuggestion();
        suggestion.boardName = boardName;
        suggestion.component = component;
        
        switch (component.toLowerCase()) {
            case "led":
                suggestion.pins.put("LED", "Any digital pin (recommended: 13 - built-in LED)");
                suggestion.pins.put("Resistor", "220Ω - 1kΩ between LED and ground");
                suggestion.exampleCode = generateLEDCode();
                break;
                
            case "servo":
                suggestion.pins.put("Signal", "Any PWM pin (recommended: 9)");
                suggestion.pins.put("Power", "5V");
                suggestion.pins.put("Ground", "GND");
                suggestion.exampleCode = generateServoCode();
                break;
                
            case "button":
                suggestion.pins.put("One side", "Any digital pin (recommended: 2 for interrupt)");
                suggestion.pins.put("Other side", "GND");
                suggestion.pins.put("Pull-up", "Internal pull-up resistor (pinMode INPUT_PULLUP)");
                suggestion.exampleCode = generateButtonCode();
                break;
                
            case "ultrasonic sensor":
            case "hc-sr04":
                suggestion.pins.put("Trigger", "Any digital pin (e.g., 7)");
                suggestion.pins.put("Echo", "Any digital pin (e.g., 8)");
                suggestion.pins.put("VCC", "5V");
                suggestion.pins.put("GND", "GND");
                suggestion.exampleCode = generateUltrasonicCode();
                break;
                
            case "temperature sensor":
            case "dht22":
            case "dht11":
                suggestion.pins.put("Data", "Any digital pin (e.g., 2)");
                suggestion.pins.put("VCC", "5V (DHT22) or 3.3V-5V (DHT11)");
                suggestion.pins.put("GND", "GND");
                suggestion.pins.put("Pull-up", "10kΩ between data and VCC");
                suggestion.exampleCode = generateDHTCode();
                break;
                
            case "lcd":
            case "16x2 lcd":
                suggestion.pins.put("VSS", "GND");
                suggestion.pins.put("VDD", "5V");
                suggestion.pins.put("V0", "Potentiometer middle pin (contrast)");
                suggestion.pins.put("RS", "Digital pin 12");
                suggestion.pins.put("RW", "GND");
                suggestion.pins.put("Enable", "Digital pin 11");
                suggestion.pins.put("D4-D7", "Digital pins 5, 4, 3, 2");
                suggestion.pins.put("Backlight+", "5V (with resistor)");
                suggestion.pins.put("Backlight-", "GND");
                suggestion.exampleCode = generateLCDCode();
                break;
        }
        
        return suggestion;
    }
    
    private static String generateLEDCode() {
        return """
            const int ledPin = 13;  // LED connected to digital pin 13
            
            void setup() {
              pinMode(ledPin, OUTPUT);  // Set the LED pin as output
            }
            
            void loop() {
              digitalWrite(ledPin, HIGH);  // Turn LED on
              delay(1000);                 // Wait 1 second
              digitalWrite(ledPin, LOW);   // Turn LED off
              delay(1000);                 // Wait 1 second
            }
            """;
    }
    
    private static String generateServoCode() {
        return """
            #include <Servo.h>
            
            Servo myservo;  // Create servo object
            int pos = 0;    // Variable to store servo position
            
            void setup() {
              myservo.attach(9);  // Attach servo to pin 9
            }
            
            void loop() {
              // Sweep from 0 to 180 degrees
              for (pos = 0; pos <= 180; pos += 1) {
                myservo.write(pos);
                delay(15);
              }
              // Sweep back from 180 to 0 degrees
              for (pos = 180; pos >= 0; pos -= 1) {
                myservo.write(pos);
                delay(15);
              }
            }
            """;
    }
    
    private static String generateButtonCode() {
        return """
            const int buttonPin = 2;  // Button connected to pin 2
            const int ledPin = 13;    // LED connected to pin 13
            
            int buttonState = 0;      // Variable for reading button status
            
            void setup() {
              pinMode(ledPin, OUTPUT);      // Set LED pin as output
              pinMode(buttonPin, INPUT_PULLUP);  // Set button pin as input with pull-up
            }
            
            void loop() {
              buttonState = digitalRead(buttonPin);  // Read button state
              
              if (buttonState == LOW) {  // Button pressed (active low)
                digitalWrite(ledPin, HIGH);  // Turn LED on
              } else {
                digitalWrite(ledPin, LOW);   // Turn LED off
              }
            }
            """;
    }
    
    private static String generateUltrasonicCode() {
        return """
            const int trigPin = 7;  // Trigger pin
            const int echoPin = 8;  // Echo pin
            
            long duration;
            int distance;
            
            void setup() {
              pinMode(trigPin, OUTPUT);
              pinMode(echoPin, INPUT);
              Serial.begin(9600);
            }
            
            void loop() {
              // Clear the trigger pin
              digitalWrite(trigPin, LOW);
              delayMicroseconds(2);
              
              // Send 10µs pulse
              digitalWrite(trigPin, HIGH);
              delayMicroseconds(10);
              digitalWrite(trigPin, LOW);
              
              // Read echo pulse duration
              duration = pulseIn(echoPin, HIGH);
              
              // Calculate distance (cm)
              distance = duration * 0.034 / 2;
              
              Serial.print("Distance: ");
              Serial.print(distance);
              Serial.println(" cm");
              
              delay(100);
            }
            """;
    }
    
    private static String generateDHTCode() {
        return """
            #include <DHT.h>
            
            #define DHTPIN 2      // DHT sensor connected to pin 2
            #define DHTTYPE DHT22 // DHT 22 (or DHT11)
            
            DHT dht(DHTPIN, DHTTYPE);
            
            void setup() {
              Serial.begin(9600);
              dht.begin();
            }
            
            void loop() {
              delay(2000);  // Wait between readings
              
              float humidity = dht.readHumidity();
              float temperature = dht.readTemperature();
              
              if (isnan(humidity) || isnan(temperature)) {
                Serial.println("Failed to read from DHT sensor!");
                return;
              }
              
              Serial.print("Humidity: ");
              Serial.print(humidity);
              Serial.print("%  Temperature: ");
              Serial.print(temperature);
              Serial.println("°C");
            }
            """;
    }
    
    private static String generateLCDCode() {
        return """
            #include <LiquidCrystal.h>
            
            // Initialize LCD with interface pins
            LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
            
            void setup() {
              // Set up LCD's columns and rows
              lcd.begin(16, 2);
              // Print a message
              lcd.print("Hello, Arduino!");
            }
            
            void loop() {
              // Set cursor to column 0, line 1
              lcd.setCursor(0, 1);
              // Print the number of seconds since reset
              lcd.print(millis() / 1000);
            }
            """;
    }
    
    public static class BoardPinConfiguration {
        final List<Integer> digitalPins;
        final List<Integer> analogPins;
        final List<Integer> pwmPins;
        final List<Integer> spiPins;
        final List<Integer> i2cPins;
        final List<Integer> serialPins;
        final List<Integer> interruptPins;
        
        public BoardPinConfiguration(List<Integer> digitalPins, List<Integer> analogPins,
                                     List<Integer> pwmPins, List<Integer> spiPins,
                                     List<Integer> i2cPins, List<Integer> serialPins,
                                     List<Integer> interruptPins) {
            this.digitalPins = digitalPins;
            this.analogPins = analogPins;
            this.pwmPins = pwmPins;
            this.spiPins = spiPins;
            this.i2cPins = i2cPins;
            this.serialPins = serialPins;
            this.interruptPins = interruptPins;
        }
    }
    
    public static class PinSuggestion {
        String boardName;
        String component;
        Map<String, String> pins = new LinkedHashMap<>();
        String exampleCode;
        
        public String getFormattedSuggestion() {
            StringBuilder sb = new StringBuilder();
            sb.append("Pin connections for ").append(component)
              .append(" on ").append(boardName).append(":\n\n");
            
            for (Map.Entry<String, String> entry : pins.entrySet()) {
                sb.append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
            }
            
            if (exampleCode != null) {
                sb.append("\nExample code:\n").append(exampleCode);
            }
            
            return sb.toString();
        }
    }
}