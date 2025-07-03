package com.arduinoai.ui;

import com.arduinoai.core.PluginManager;
import com.arduinoai.providers.AIProvider;
import com.arduinoai.providers.ollama.OllamaProvider;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.List;

public class ModelInfoPanel extends JPanel {
    
    private final PluginManager pluginManager;
    
    private JLabel providerLabel;
    private JLabel modelLabel;
    private JLabel statusLabel;
    private JTable modelTable;
    private DefaultTableModel tableModel;
    private JButton refreshButton;
    private JButton testButton;
    
    public ModelInfoPanel(PluginManager pluginManager) {
        this.pluginManager = pluginManager;
        
        setLayout(new BorderLayout());
        
        createComponents();
        layoutComponents();
        
        // Initial update
        updateModelInfo();
    }
    
    private void createComponents() {
        providerLabel = new JLabel("Provider: Loading...");
        providerLabel.setFont(new Font("Dialog", Font.BOLD, 14));
        
        modelLabel = new JLabel("Model: Loading...");
        statusLabel = new JLabel("Status: Checking...");
        
        // Model table
        String[] columns = {"Property", "Value"};
        tableModel = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        modelTable = new JTable(tableModel);
        modelTable.setShowGrid(true);
        modelTable.setGridColor(Color.LIGHT_GRAY);
        
        refreshButton = new JButton("Refresh");
        refreshButton.addActionListener(e -> updateModelInfo());
        
        testButton = new JButton("Test Connection");
        testButton.addActionListener(e -> testConnection());
    }
    
    private void layoutComponents() {
        // Header panel
        JPanel headerPanel = new JPanel();
        headerPanel.setLayout(new BoxLayout(headerPanel, BoxLayout.Y_AXIS));
        headerPanel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        headerPanel.add(providerLabel);
        headerPanel.add(Box.createVerticalStrut(5));
        headerPanel.add(modelLabel);
        headerPanel.add(Box.createVerticalStrut(5));
        headerPanel.add(statusLabel);
        
        add(headerPanel, BorderLayout.NORTH);
        
        // Table
        JScrollPane scrollPane = new JScrollPane(modelTable);
        scrollPane.setBorder(BorderFactory.createTitledBorder("Model Details"));
        add(scrollPane, BorderLayout.CENTER);
        
        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout());
        buttonPanel.add(refreshButton);
        buttonPanel.add(testButton);
        add(buttonPanel, BorderLayout.SOUTH);
    }
    
    private void updateModelInfo() {
        SwingUtilities.invokeLater(() -> {
            AIProvider provider = pluginManager.getCurrentProvider();
            
            if (provider == null) {
                providerLabel.setText("Provider: Not configured");
                modelLabel.setText("Model: N/A");
                statusLabel.setText("Status: No provider available");
                tableModel.setRowCount(0);
                return;
            }
            
            // Update labels
            providerLabel.setText("Provider: " + provider.getName());
            modelLabel.setText("Model: " + provider.getCurrentModel());
            statusLabel.setText("Status: " + (provider.isAvailable() ? "Available" : "Not available"));
            
            // Update table
            tableModel.setRowCount(0);
            tableModel.addRow(new Object[]{"Provider Type", provider.getName()});
            tableModel.addRow(new Object[]{"Current Model", provider.getCurrentModel()});
            tableModel.addRow(new Object[]{"Available", provider.isAvailable() ? "Yes" : "No"});
            
            // Add available models
            List<String> models = provider.getAvailableModels();
            if (!models.isEmpty()) {
                tableModel.addRow(new Object[]{"Available Models", String.join(", ", models)});
            }
            
            // Special handling for Ollama
            if (provider instanceof OllamaProvider) {
                updateOllamaInfo((OllamaProvider) provider);
            }
        });
    }
    
    private void updateOllamaInfo(OllamaProvider ollama) {
        ollama.getDetailedModels().thenAccept(models -> {
            SwingUtilities.invokeLater(() -> {
                if (!models.isEmpty()) {
                    tableModel.addRow(new Object[]{"", ""});
                    tableModel.addRow(new Object[]{"Local Models", "Size"});
                    
                    for (OllamaProvider.OllamaModel model : models) {
                        tableModel.addRow(new Object[]{
                            model.name,
                            model.getFormattedSize()
                        });
                    }
                }
            });
        });
    }
    
    private void testConnection() {
        AIProvider provider = pluginManager.getCurrentProvider();
        if (provider == null) {
            JOptionPane.showMessageDialog(this, 
                "No AI provider configured", 
                "Test Failed", 
                JOptionPane.ERROR_MESSAGE);
            return;
        }
        
        testButton.setEnabled(false);
        statusLabel.setText("Status: Testing connection...");
        
        provider.testConnection().thenAccept(success -> {
            SwingUtilities.invokeLater(() -> {
                if (success) {
                    statusLabel.setText("Status: Connection successful!");
                    JOptionPane.showMessageDialog(this, 
                        "Successfully connected to " + provider.getName(), 
                        "Connection Test", 
                        JOptionPane.INFORMATION_MESSAGE);
                } else {
                    statusLabel.setText("Status: Connection failed");
                    JOptionPane.showMessageDialog(this, 
                        "Failed to connect to " + provider.getName(), 
                        "Connection Test", 
                        JOptionPane.ERROR_MESSAGE);
                }
                testButton.setEnabled(true);
            });
        }).exceptionally(throwable -> {
            SwingUtilities.invokeLater(() -> {
                statusLabel.setText("Status: Connection error");
                JOptionPane.showMessageDialog(this, 
                    "Connection test error: " + throwable.getMessage(), 
                    "Test Failed", 
                    JOptionPane.ERROR_MESSAGE);
                testButton.setEnabled(true);
            });
            return null;
        });
    }
}