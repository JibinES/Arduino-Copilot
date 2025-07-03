package com.arduinoai.completion;

import com.arduinoai.providers.AIProvider.CompletionResponse;
import org.fife.ui.rsyntaxtextarea.RSyntaxTextArea;
import org.fife.ui.rsyntaxtextarea.SyntaxConstants;

import javax.swing.*;
import javax.swing.text.BadLocationException;
import javax.swing.text.JTextComponent;
import java.awt.*;
import java.awt.event.*;
import java.util.ArrayList;
import java.util.List;

public class CompletionPopup {
    
    private final JTextComponent editor;
    private final CompletionResponse response;
    private final int triggerPosition;
    
    private JWindow popupWindow;
    private JList<CompletionItem> completionList;
    private DefaultListModel<CompletionItem> listModel;
    private RSyntaxTextArea previewArea;
    
    public CompletionPopup(JTextComponent editor, CompletionResponse response, int triggerPosition) {
        this.editor = editor;
        this.response = response;
        this.triggerPosition = triggerPosition;
        
        createPopup();
    }
    
    private void createPopup() {
        Window parentWindow = SwingUtilities.getWindowAncestor(editor);
        popupWindow = new JWindow(parentWindow);
        popupWindow.setFocusableWindowState(false);
        
        JPanel content = new JPanel(new BorderLayout());
        content.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        content.setBackground(UIManager.getColor("Panel.background"));
        
        // Create completion list
        listModel = new DefaultListModel<>();
        
        // Add main completion
        listModel.addElement(new CompletionItem(response.getCompletion(), "AI Suggestion", 
                                                 response.getConfidence()));
        
        // Add alternatives
        int altIndex = 1;
        for (String alt : response.getAlternatives()) {
            listModel.addElement(new CompletionItem(alt, "Alternative " + altIndex++, 0.5));
        }
        
        completionList = new JList<>(listModel);
        completionList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        completionList.setSelectedIndex(0);
        completionList.setCellRenderer(new CompletionCellRenderer());
        
        // Add selection listener
        completionList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting()) {
                updatePreview();
            }
        });
        
        // Create split pane with list and preview
        JSplitPane splitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        
        // List panel
        JScrollPane listScroll = new JScrollPane(completionList);
        listScroll.setPreferredSize(new Dimension(400, 100));
        splitPane.setTopComponent(listScroll);
        
        // Preview panel
        previewArea = new RSyntaxTextArea(5, 40);
        previewArea.setSyntaxEditingStyle(SyntaxConstants.SYNTAX_STYLE_CPLUSPLUS);
        previewArea.setCodeFoldingEnabled(true);
        previewArea.setEditable(false);
        previewArea.setFont(editor.getFont());
        
        JScrollPane previewScroll = new JScrollPane(previewArea);
        previewScroll.setBorder(BorderFactory.createTitledBorder("Preview"));
        splitPane.setBottomComponent(previewScroll);
        
        splitPane.setDividerLocation(100);
        content.add(splitPane, BorderLayout.CENTER);
        
        // Add keyboard handling
        setupKeyboardHandling();
        
        // Add footer with shortcuts
        JPanel footer = new JPanel(new FlowLayout(FlowLayout.LEFT));
        footer.setBackground(content.getBackground());
        footer.add(new JLabel("Tab: Accept | Esc: Cancel | ↑↓: Navigate"));
        content.add(footer, BorderLayout.SOUTH);
        
        popupWindow.setContentPane(content);
        popupWindow.pack();
        
        // Update preview for initial selection
        updatePreview();
    }
    
    private void setupKeyboardHandling() {
        // Register key bindings on the editor
        InputMap inputMap = editor.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actionMap = editor.getActionMap();
        
        // Escape to cancel
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "cancelCompletion");
        actionMap.put("cancelCompletion", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                hide();
            }
        });
        
        // Up/Down to navigate
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP, 0), "previousCompletion");
        actionMap.put("previousCompletion", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int index = completionList.getSelectedIndex();
                if (index > 0) {
                    completionList.setSelectedIndex(index - 1);
                    completionList.ensureIndexIsVisible(index - 1);
                }
            }
        });
        
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0), "nextCompletion");
        actionMap.put("nextCompletion", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int index = completionList.getSelectedIndex();
                if (index < listModel.getSize() - 1) {
                    completionList.setSelectedIndex(index + 1);
                    completionList.ensureIndexIsVisible(index + 1);
                }
            }
        });
        
        // Tab is handled by the completion engine
    }
    
    private void updatePreview() {
        CompletionItem selected = completionList.getSelectedValue();
        if (selected != null) {
            try {
                // Get text before and after cursor
                String before = editor.getText(0, triggerPosition);
                String after = editor.getText(triggerPosition, 
                                               editor.getDocument().getLength() - triggerPosition);
                
                // Show preview with completion inserted
                String preview = before + selected.completion + after;
                previewArea.setText(preview);
                
                // Highlight the inserted part
                previewArea.setCaretPosition(triggerPosition);
                previewArea.moveCaretPosition(triggerPosition + selected.completion.length());
                
            } catch (BadLocationException e) {
                previewArea.setText(selected.completion);
            }
        }
    }
    
    public void show() {
        try {
            // Calculate popup position
            Rectangle caretBounds = editor.modelToView(triggerPosition);
            Point locationOnScreen = editor.getLocationOnScreen();
            
            int x = locationOnScreen.x + caretBounds.x;
            int y = locationOnScreen.y + caretBounds.y + caretBounds.height;
            
            // Adjust if popup goes off screen
            Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
            Dimension popupSize = popupWindow.getSize();
            
            if (x + popupSize.width > screenSize.width) {
                x = screenSize.width - popupSize.width;
            }
            
            if (y + popupSize.height > screenSize.height) {
                y = locationOnScreen.y + caretBounds.y - popupSize.height;
            }
            
            popupWindow.setLocation(x, y);
            popupWindow.setVisible(true);
            
            // Request focus back to editor
            editor.requestFocusInWindow();
            
        } catch (BadLocationException e) {
            // Fallback position
            Point p = editor.getLocationOnScreen();
            popupWindow.setLocation(p.x + 50, p.y + 50);
            popupWindow.setVisible(true);
        }
    }
    
    public void hide() {
        if (popupWindow != null) {
            popupWindow.setVisible(false);
            popupWindow.dispose();
            
            // Remove key bindings
            InputMap inputMap = editor.getInputMap(JComponent.WHEN_FOCUSED);
            ActionMap actionMap = editor.getActionMap();
            
            inputMap.remove(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0));
            inputMap.remove(KeyStroke.getKeyStroke(KeyEvent.VK_UP, 0));
            inputMap.remove(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0));
            
            actionMap.remove("cancelCompletion");
            actionMap.remove("previousCompletion");
            actionMap.remove("nextCompletion");
        }
    }
    
    public boolean isVisible() {
        return popupWindow != null && popupWindow.isVisible();
    }
    
    public void acceptSelected() {
        CompletionItem selected = completionList.getSelectedValue();
        if (selected != null) {
            try {
                editor.getDocument().insertString(triggerPosition, selected.completion, null);
                hide();
            } catch (BadLocationException e) {
                // Ignore
            }
        }
    }
    
    // Inner classes
    
    private static class CompletionItem {
        final String completion;
        final String label;
        final double confidence;
        
        CompletionItem(String completion, String label, double confidence) {
            this.completion = completion;
            this.label = label;
            this.confidence = confidence;
        }
    }
    
    private static class CompletionCellRenderer extends DefaultListCellRenderer {
        @Override
        public Component getListCellRendererComponent(JList<?> list, Object value, int index,
                                                      boolean isSelected, boolean cellHasFocus) {
            super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus);
            
            if (value instanceof CompletionItem) {
                CompletionItem item = (CompletionItem) value;
                
                // Create HTML for better formatting
                StringBuilder html = new StringBuilder("<html>");
                html.append("<b>").append(item.label).append("</b>");
                
                if (item.confidence > 0) {
                    html.append(" <font color='gray'>(");
                    html.append(String.format("%.0f%%", item.confidence * 100));
                    html.append(")</font>");
                }
                
                // Show preview of completion
                String preview = item.completion.replace("\n", " ")
                                                .replace("\r", "");
                if (preview.length() > 50) {
                    preview = preview.substring(0, 47) + "...";
                }
                html.append("<br><font size='-1' color='#666666'>");
                html.append(preview);
                html.append("</font></html>");
                
                setText(html.toString());
            }
            
            return this;
        }
    }
}