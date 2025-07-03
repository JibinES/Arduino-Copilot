package com.arduinoai.ui;

import com.arduinoai.core.PluginManager;
import com.arduinoai.chat.ChatManager;
import com.arduinoai.providers.AIProvider.ChatMessage;
import org.fife.ui.rsyntaxtextarea.RSyntaxTextArea;
import org.fife.ui.rsyntaxtextarea.SyntaxConstants;

import javax.swing.*;
import javax.swing.text.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.List;

public class ChatPanel extends JPanel implements ChatManager.ChatListener {
    
    private final PluginManager pluginManager;
    private final ChatManager chatManager;
    
    private JTextPane chatDisplay;
    private JTextArea inputArea;
    private JButton sendButton;
    private JProgressBar progressBar;
    private JLabel statusLabel;
    
    private StyledDocument doc;
    private Style userStyle;
    private Style assistantStyle;
    private Style codeStyle;
    private Style errorStyle;
    
    public ChatPanel(PluginManager pluginManager) {
        this.pluginManager = pluginManager;
        this.chatManager = pluginManager.getChatManager();
        
        setLayout(new BorderLayout());
        
        initializeStyles();
        createComponents();
        layoutComponents();
        
        // Register as listener
        chatManager.addListener(this);
        
        // Load existing chat history
        loadChatHistory();
    }
    
    private void initializeStyles() {
        // Initialize styles for different message types
    }
    
    private void createComponents() {
        // Chat display
        chatDisplay = new JTextPane();
        chatDisplay.setEditable(false);
        doc = chatDisplay.getStyledDocument();
        
        // Define styles
        userStyle = chatDisplay.addStyle("user", null);
        StyleConstants.setForeground(userStyle, new Color(0, 102, 204));
        StyleConstants.setBold(userStyle, true);
        
        assistantStyle = chatDisplay.addStyle("assistant", null);
        StyleConstants.setForeground(assistantStyle, new Color(0, 153, 0));
        StyleConstants.setBold(assistantStyle, true);
        
        codeStyle = chatDisplay.addStyle("code", null);
        StyleConstants.setFontFamily(codeStyle, "Monospaced");
        StyleConstants.setBackground(codeStyle, new Color(245, 245, 245));
        
        errorStyle = chatDisplay.addStyle("error", null);
        StyleConstants.setForeground(errorStyle, Color.RED);
        StyleConstants.setItalic(errorStyle, true);
        
        // Input area
        inputArea = new JTextArea(3, 30);
        inputArea.setLineWrap(true);
        inputArea.setWrapStyleWord(true);
        inputArea.setFont(new Font("Dialog", Font.PLAIN, 12));
        
        // Add key listener for Ctrl+Enter
        inputArea.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER && e.isControlDown()) {
                    sendMessage();
                    e.consume();
                }
            }
        });
        
        // Send button
        sendButton = new JButton("Send");
        sendButton.addActionListener(e -> sendMessage());
        
        // Progress bar
        progressBar = new JProgressBar();
        progressBar.setIndeterminate(true);
        progressBar.setVisible(false);
        
        // Status label
        statusLabel = new JLabel("Ready");
        statusLabel.setFont(new Font("Dialog", Font.PLAIN, 11));
    }
    
    private void layoutComponents() {
        // Chat display in scroll pane
        JScrollPane chatScroll = new JScrollPane(chatDisplay);
        chatScroll.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
        add(chatScroll, BorderLayout.CENTER);
        
        // Bottom panel with input
        JPanel bottomPanel = new JPanel(new BorderLayout());
        
        // Input panel
        JPanel inputPanel = new JPanel(new BorderLayout());
        inputPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        
        // Input area with scroll
        JScrollPane inputScroll = new JScrollPane(inputArea);
        inputScroll.setPreferredSize(new Dimension(0, 60));
        inputPanel.add(inputScroll, BorderLayout.CENTER);
        
        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.add(new JLabel("Ctrl+Enter to send"));
        buttonPanel.add(sendButton);
        inputPanel.add(buttonPanel, BorderLayout.SOUTH);
        
        bottomPanel.add(inputPanel, BorderLayout.CENTER);
        
        // Status panel
        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setBorder(BorderFactory.createEmptyBorder(2, 5, 2, 5));
        statusPanel.add(progressBar, BorderLayout.CENTER);
        statusPanel.add(statusLabel, BorderLayout.WEST);
        
        bottomPanel.add(statusPanel, BorderLayout.SOUTH);
        
        add(bottomPanel, BorderLayout.SOUTH);
        
        // Toolbar
        add(createToolbar(), BorderLayout.NORTH);
    }
    
    private JToolBar createToolbar() {
        JToolBar toolbar = new JToolBar();
        toolbar.setFloatable(false);
        
        JButton clearButton = new JButton("Clear Chat");
        clearButton.addActionListener(e -> clearChat());
        toolbar.add(clearButton);
        
        toolbar.addSeparator();
        
        JButton insertCodeButton = new JButton("Insert Code");
        insertCodeButton.setToolTipText("Insert current sketch code into chat");
        insertCodeButton.addActionListener(e -> insertCurrentCode());
        toolbar.add(insertCodeButton);
        
        JButton insertErrorButton = new JButton("Insert Error");
        insertErrorButton.setToolTipText("Insert last compilation error");
        insertErrorButton.addActionListener(e -> insertLastError());
        toolbar.add(insertErrorButton);
        
        toolbar.addSeparator();
        
        JButton exportButton = new JButton("Export Chat");
        exportButton.addActionListener(e -> exportChat());
        toolbar.add(exportButton);
        
        return toolbar;
    }
    
    private void sendMessage() {
        String message = inputArea.getText().trim();
        if (message.isEmpty() || chatManager.isProcessing()) {
            return;
        }
        
        // Clear input
        inputArea.setText("");
        inputArea.requestFocus();
        
        // Send message
        chatManager.sendMessage(message);
    }
    
    private void appendMessage(String sender, String message, Style senderStyle) {
        SwingUtilities.invokeLater(() -> {
            try {
                // Add sender
                doc.insertString(doc.getLength(), sender + ": ", senderStyle);
                
                // Process message for code blocks
                processAndAppendMessage(message);
                
                // Add newline
                doc.insertString(doc.getLength(), "\n\n", null);
                
                // Scroll to bottom
                chatDisplay.setCaretPosition(doc.getLength());
            } catch (BadLocationException e) {
                e.printStackTrace();
            }
        });
    }
    
    private void processAndAppendMessage(String message) throws BadLocationException {
        // Simple code block detection
        String[] parts = message.split("```");
        
        for (int i = 0; i < parts.length; i++) {
            if (i % 2 == 0) {
                // Regular text
                doc.insertString(doc.getLength(), parts[i], null);
            } else {
                // Code block
                String code = parts[i];
                
                // Remove language identifier if present
                if (code.startsWith("cpp\n") || code.startsWith("c++\n") || 
                    code.startsWith("arduino\n")) {
                    code = code.substring(code.indexOf('\n') + 1);
                }
                
                doc.insertString(doc.getLength(), "\n", null);
                
                // Add code in a panel for better visibility
                insertCodePanel(code.trim());
                
                doc.insertString(doc.getLength(), "\n", null);
            }
        }
    }
    
    private void insertCodePanel(String code) {
        // Create syntax highlighted code area
        RSyntaxTextArea codeArea = new RSyntaxTextArea();
        codeArea.setSyntaxEditingStyle(SyntaxConstants.SYNTAX_STYLE_CPLUSPLUS);
        codeArea.setText(code);
        codeArea.setEditable(false);
        codeArea.setBackground(new Color(245, 245, 245));
        
        // Calculate size
        int lines = code.split("\n").length;
        codeArea.setRows(Math.min(lines, 20));
        
        // Create panel with border
        JPanel codePanel = new JPanel(new BorderLayout());
        codePanel.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        codePanel.add(new JScrollPane(codeArea), BorderLayout.CENTER);
        
        // Add copy button
        JButton copyButton = new JButton("Copy");
        copyButton.addActionListener(e -> {
            StringSelection selection = new StringSelection(code);
            Toolkit.getDefaultToolkit().getSystemClipboard().setContents(selection, null);
        });
        
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.add(copyButton);
        codePanel.add(buttonPanel, BorderLayout.SOUTH);
        
        // Insert into document
        chatDisplay.insertComponent(codePanel);
    }
    
    private void clearChat() {
        int result = JOptionPane.showConfirmDialog(
            this,
            "Clear all chat history?",
            "Clear Chat",
            JOptionPane.YES_NO_OPTION
        );
        
        if (result == JOptionPane.YES_OPTION) {
            chatDisplay.setText("");
            chatManager.clearHistory();
        }
    }
    
    private void insertCurrentCode() {
        String code = pluginManager.getCurrentSketchCode();
        if (!code.isEmpty()) {
            inputArea.insert("```cpp\n" + code + "\n```\n", inputArea.getCaretPosition());
        }
    }
    
    private void insertLastError() {
        // TODO: Get last compilation error from Arduino IDE
        inputArea.insert("[Last compilation error would be inserted here]", 
                         inputArea.getCaretPosition());
    }
    
    private void exportChat() {
        JFileChooser fileChooser = new JFileChooser();
        fileChooser.setSelectedFile(new java.io.File("arduino_chat_export.md"));
        
        if (fileChooser.showSaveDialog(this) == JFileChooser.APPROVE_OPTION) {
            try {
                java.io.File file = fileChooser.getSelectedFile();
                java.io.PrintWriter writer = new java.io.PrintWriter(file);
                
                writer.println("# Arduino AI Copilot Chat Export");
                writer.println("Date: " + new java.util.Date());
                writer.println("\n---\n");
                
                List<ChatMessage> history = chatManager.getChatHistory();
                for (ChatMessage msg : history) {
                    if (msg.getRole() != ChatMessage.Role.SYSTEM) {
                        writer.printf("**%s**: %s\n\n", 
                                      msg.getRole() == ChatMessage.Role.USER ? "User" : "Assistant",
                                      msg.getContent());
                    }
                }
                
                writer.close();
                
                JOptionPane.showMessageDialog(this, "Chat exported successfully!");
            } catch (Exception e) {
                JOptionPane.showMessageDialog(this, 
                    "Failed to export chat: " + e.getMessage(),
                    "Export Error",
                    JOptionPane.ERROR_MESSAGE);
            }
        }
    }
    
    private void loadChatHistory() {
        List<ChatMessage> history = chatManager.getChatHistory();
        for (ChatMessage msg : history) {
            if (msg.getRole() == ChatMessage.Role.USER) {
                appendMessage("You", msg.getContent(), userStyle);
            } else if (msg.getRole() == ChatMessage.Role.ASSISTANT) {
                appendMessage("AI", msg.getContent(), assistantStyle);
            }
        }
    }
    
    // ChatManager.ChatListener implementation
    
    @Override
    public void onMessageSent(String message) {
        appendMessage("You", message, userStyle);
    }
    
    @Override
    public void onResponseReceived(String response) {
        appendMessage("AI", response, assistantStyle);
    }
    
    @Override
    public void onError(String error) {
        SwingUtilities.invokeLater(() -> {
            try {
                doc.insertString(doc.getLength(), "Error: " + error + "\n\n", errorStyle);
                chatDisplay.setCaretPosition(doc.getLength());
            } catch (BadLocationException e) {
                e.printStackTrace();
            }
        });
    }
    
    @Override
    public void onProcessingStateChanged(boolean isProcessing) {
        SwingUtilities.invokeLater(() -> {
            sendButton.setEnabled(!isProcessing);
            progressBar.setVisible(isProcessing);
            statusLabel.setText(isProcessing ? "Processing..." : "Ready");
        });
    }
    
    public void cleanup() {
        chatManager.removeListener(this);
    }
}