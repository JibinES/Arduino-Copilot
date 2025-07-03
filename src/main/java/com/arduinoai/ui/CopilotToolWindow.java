package com.arduinoai.ui;

import com.arduinoai.core.PluginManager;
import com.arduinoai.chat.ChatManager;
import com.formdev.flatlaf.FlatLightLaf;
import processing.app.Editor;

import javax.swing.*;
import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

public class CopilotToolWindow extends JFrame {
    
    private final Editor editor;
    private final PluginManager pluginManager;
    private final ChatPanel chatPanel;
    
    public CopilotToolWindow(Editor editor, PluginManager pluginManager) {
        super("Arduino AI Copilot");
        this.editor = editor;
        this.pluginManager = pluginManager;
        
        // Setup look and feel
        try {
            UIManager.setLookAndFeel(new FlatLightLaf());
        } catch (Exception e) {
            // Use default look and feel
        }
        
        // Setup window
        setDefaultCloseOperation(JFrame.HIDE_ON_CLOSE);
        setPreferredSize(new Dimension(400, 600));
        
        // Create main panel with tabs
        JTabbedPane tabbedPane = new JTabbedPane();
        
        // Chat panel
        chatPanel = new ChatPanel(pluginManager);
        tabbedPane.addTab("Chat", createIcon("chat"), chatPanel, "AI Chat Assistant");
        
        // Quick actions panel
        JPanel quickActionsPanel = createQuickActionsPanel();
        tabbedPane.addTab("Quick Actions", createIcon("lightning"), quickActionsPanel, 
                          "Quick AI Actions");
        
        // Model info panel
        JPanel modelInfoPanel = createModelInfoPanel();
        tabbedPane.addTab("Model Info", createIcon("info"), modelInfoPanel, 
                          "Current Model Information");
        
        add(tabbedPane);
        
        // Setup docking behavior
        setupDocking();
        
        pack();
        setLocationRelativeTo(editor);
    }
    
    private void setupDocking() {
        // Make window always on top of the editor
        setAlwaysOnTop(false);
        
        // Add window listener to handle docking behavior
        addWindowListener(new WindowAdapter() {
            @Override
            public void windowOpened(WindowEvent e) {
                positionNextToEditor();
            }
        });
        
        // Keep window size preference
        addComponentListener(new java.awt.event.ComponentAdapter() {
            @Override
            public void componentResized(java.awt.event.ComponentEvent e) {
                // Save preferred size
            }
        });
    }
    
    private void positionNextToEditor() {
        if (editor != null) {
            Point editorLocation = editor.getLocation();
            Dimension editorSize = editor.getSize();
            
            // Position to the right of editor
            int x = editorLocation.x + editorSize.width;
            int y = editorLocation.y;
            
            // Check if it fits on screen
            Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
            if (x + getWidth() > screenSize.width) {
                // Position to the left instead
                x = editorLocation.x - getWidth();
            }
            
            setLocation(x, y);
        }
    }
    
    private JPanel createQuickActionsPanel() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Add quick action buttons
        panel.add(createActionButton("Explain Selected Code", "explain", e -> {
            String selected = editor.getSelectedText();
            if (selected != null && !selected.isEmpty()) {
                pluginManager.explainCode(selected);
                showChatPanel();
            } else {
                JOptionPane.showMessageDialog(this, 
                    "Please select some code first", 
                    "No Selection", 
                    JOptionPane.INFORMATION_MESSAGE);
            }
        }));
        
        panel.add(Box.createVerticalStrut(5));
        
        panel.add(createActionButton("Generate Function", "function", e -> {
            showGenerateFunctionDialog();
        }));
        
        panel.add(Box.createVerticalStrut(5));
        
        panel.add(createActionButton("Fix Compilation Errors", "fix", e -> {
            // TODO: Get compilation errors and send to chat
            showChatPanel();
        }));
        
        panel.add(Box.createVerticalStrut(5));
        
        panel.add(createActionButton("Suggest Pin Connections", "pin", e -> {
            showPinConnectionDialog();
        }));
        
        panel.add(Box.createVerticalStrut(5));
        
        panel.add(createActionButton("Find Arduino Libraries", "library", e -> {
            showLibraryFinderDialog();
        }));
        
        panel.add(Box.createVerticalStrut(5));
        
        panel.add(createActionButton("Optimize for Memory", "memory", e -> {
            String code = pluginManager.getCurrentSketchCode();
            if (!code.isEmpty()) {
                pluginManager.getChatManager().suggestOptimization(code);
                showChatPanel();
            }
        }));
        
        panel.add(Box.createVerticalGlue());
        
        return panel;
    }
    
    private JPanel createModelInfoPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        ModelInfoPanel modelInfo = new ModelInfoPanel(pluginManager);
        panel.add(modelInfo, BorderLayout.CENTER);
        
        return panel;
    }
    
    private JButton createActionButton(String text, String iconName, java.awt.event.ActionListener listener) {
        JButton button = new JButton(text, createIcon(iconName));
        button.setAlignmentX(Component.LEFT_ALIGNMENT);
        button.setMaximumSize(new Dimension(Integer.MAX_VALUE, button.getPreferredSize().height));
        button.addActionListener(listener);
        return button;
    }
    
    private void showChatPanel() {
        JTabbedPane tabbedPane = (JTabbedPane) getContentPane().getComponent(0);
        tabbedPane.setSelectedIndex(0); // Chat is first tab
    }
    
    private void showGenerateFunctionDialog() {
        JPanel panel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.insets = new Insets(5, 5, 5, 5);
        
        gbc.gridx = 0; gbc.gridy = 0;
        panel.add(new JLabel("Function Name:"), gbc);
        
        gbc.gridx = 1;
        JTextField nameField = new JTextField(20);
        panel.add(nameField, gbc);
        
        gbc.gridx = 0; gbc.gridy = 1;
        panel.add(new JLabel("Description:"), gbc);
        
        gbc.gridx = 1;
        JTextArea descArea = new JTextArea(3, 20);
        descArea.setLineWrap(true);
        panel.add(new JScrollPane(descArea), gbc);
        
        gbc.gridx = 0; gbc.gridy = 2;
        panel.add(new JLabel("Return Type:"), gbc);
        
        gbc.gridx = 1;
        JComboBox<String> returnType = new JComboBox<>(
            new String[]{"void", "int", "float", "bool", "String", "char", "byte"}
        );
        panel.add(returnType, gbc);
        
        int result = JOptionPane.showConfirmDialog(this, panel, 
            "Generate Function", JOptionPane.OK_CANCEL_OPTION);
        
        if (result == JOptionPane.OK_OPTION) {
            String prompt = String.format(
                "Generate an Arduino function named '%s' that %s and returns %s. " +
                "Include appropriate parameter types based on the description.",
                nameField.getText(),
                descArea.getText(),
                returnType.getSelectedItem()
            );
            
            pluginManager.sendChatMessage(prompt);
            showChatPanel();
        }
    }
    
    private void showPinConnectionDialog() {
        String[] components = {
            "LED", "Button", "Servo", "Motor", "Sensor", 
            "LCD Display", "OLED Display", "Relay", "Buzzer"
        };
        
        String component = (String) JOptionPane.showInputDialog(
            this,
            "Select component to connect:",
            "Pin Connection Helper",
            JOptionPane.QUESTION_MESSAGE,
            null,
            components,
            components[0]
        );
        
        if (component != null) {
            String board = editor.getBoardName();
            String prompt = String.format(
                "Show me how to connect a %s to an %s board. " +
                "Include pin connections, required resistors, and example code.",
                component, board
            );
            
            pluginManager.sendChatMessage(prompt);
            showChatPanel();
        }
    }
    
    private void showLibraryFinderDialog() {
        String purpose = JOptionPane.showInputDialog(
            this,
            "What do you want to do? (e.g., 'control a servo', 'read temperature')",
            "Find Arduino Library",
            JOptionPane.QUESTION_MESSAGE
        );
        
        if (purpose != null && !purpose.trim().isEmpty()) {
            String prompt = String.format(
                "What Arduino library should I use to %s? " +
                "Please suggest the best library with installation instructions and example usage.",
                purpose
            );
            
            pluginManager.sendChatMessage(prompt);
            showChatPanel();
        }
    }
    
    private Icon createIcon(String name) {
        // Placeholder for icon creation
        // In a real implementation, load actual icons
        return UIManager.getIcon("FileView.computerIcon");
    }
    
    @Override
    public void dispose() {
        super.dispose();
        if (chatPanel != null) {
            chatPanel.cleanup();
        }
    }
}