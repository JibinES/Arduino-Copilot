import React, { useState, useCallback } from "react";

interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
}

interface WelcomeScreenProps {
  providers: ProviderInfo[];
  onSelectProvider: (id: string) => void;
  onSaveApiKey: (providerId: string, key: string) => void;
  onComplete: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 24,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    color: "var(--vscode-foreground, #ccc)",
    textAlign: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--vscode-foreground, #ccc)",
  },
  subtitle: {
    fontSize: 13,
    color: "var(--vscode-descriptionForeground, #aaa)",
    marginBottom: 24,
    lineHeight: "1.5",
  },
  stepIndicator: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--vscode-badge-background, #4d4d4d)",
    transition: "background 0.2s",
  },
  stepDotActive: {
    background: "var(--vscode-button-background, #0e639c)",
  },
  providerList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    maxWidth: 280,
    marginBottom: 20,
  },
  providerButton: {
    background: "var(--vscode-button-secondaryBackground, #3a3d41)",
    color: "var(--vscode-button-secondaryForeground, #cccccc)",
    border: "2px solid transparent",
    borderRadius: 6,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "border-color 0.15s",
  },
  providerButtonSelected: {
    borderColor: "var(--vscode-button-background, #0e639c)",
    background: "var(--vscode-list-activeSelectionBackground, #094771)",
  },
  freeBadge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 8,
    background: "var(--vscode-testing-iconPassed, #73c991)",
    color: "#000",
    fontWeight: 700,
  },
  keySection: {
    width: "100%",
    maxWidth: 280,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #cccccc)",
    border: "1px solid var(--vscode-input-border, #3c3c3c)",
    borderRadius: 4,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    outline: "none",
    boxSizing: "border-box",
    marginTop: 8,
  },
  primaryButton: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #ffffff)",
    border: "none",
    borderRadius: 4,
    padding: "8px 24px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontWeight: 600,
    marginTop: 12,
  },
  secondaryButton: {
    background: "transparent",
    color: "var(--vscode-textLink-foreground, #3794ff)",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    padding: "4px 8px",
    marginTop: 8,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  providers,
  onSelectProvider,
  onSaveApiKey,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");

  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider);
  const needsKey = selectedProviderInfo?.requiresApiKey ?? false;

  const handleProviderSelect = useCallback(
    (id: string) => {
      setSelectedProvider(id);
      onSelectProvider(id);
    },
    [onSelectProvider]
  );

  const handleNext = useCallback(() => {
    if (step === 0 && selectedProvider) {
      if (needsKey) {
        setStep(1);
      } else {
        setStep(2);
      }
    } else if (step === 1) {
      if (apiKey.trim()) {
        onSaveApiKey(selectedProvider, apiKey.trim());
      }
      setStep(2);
    }
  }, [step, selectedProvider, needsKey, apiKey, onSaveApiKey]);

  const renderStepDots = () => (
    <div style={styles.stepIndicator}>
      {[0, 1, 2].map((s) => (
        <span
          key={s}
          style={{
            ...styles.stepDot,
            ...(step >= s ? styles.stepDotActive : {}),
          }}
        />
      ))}
    </div>
  );

  if (step === 0) {
    return (
      <div style={styles.container}>
        {renderStepDots()}
        <div style={styles.title}>Welcome to ArduinoBot!</div>
        <div style={styles.subtitle}>
          Your AI assistant for Arduino development.
          <br />
          Choose an AI provider to get started.
        </div>
        <div style={styles.providerList}>
          {providers.map((p) => (
            <button
              key={p.id}
              style={{
                ...styles.providerButton,
                ...(selectedProvider === p.id ? styles.providerButtonSelected : {}),
              }}
              onClick={() => handleProviderSelect(p.id)}
            >
              <span>{p.name}</span>
              {!p.requiresApiKey && <span style={styles.freeBadge}>FREE</span>}
            </button>
          ))}
        </div>
        <button
          style={{
            ...styles.primaryButton,
            opacity: selectedProvider ? 1 : 0.5,
            cursor: selectedProvider ? "pointer" : "default",
          }}
          onClick={handleNext}
          disabled={!selectedProvider}
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div style={styles.container}>
        {renderStepDots()}
        <div style={styles.title}>Enter API Key</div>
        <div style={styles.subtitle}>
          To use {selectedProviderInfo?.name}, you need an API key.
          <br />
          You can find this in your provider's dashboard.
        </div>
        <div style={styles.keySection}>
          <input
            type="password"
            style={styles.input}
            placeholder={`Paste your ${selectedProviderInfo?.name} API key`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <button
          style={{
            ...styles.primaryButton,
            opacity: apiKey.trim() ? 1 : 0.5,
            cursor: apiKey.trim() ? "pointer" : "default",
          }}
          onClick={handleNext}
          disabled={!apiKey.trim()}
        >
          Continue
        </button>
        <button style={styles.secondaryButton} onClick={() => setStep(0)}>
          Go back
        </button>
      </div>
    );
  }

  // Step 2: Ready
  return (
    <div style={styles.container}>
      {renderStepDots()}
      <div style={styles.successIcon}>&#10003;</div>
      <div style={styles.title}>You're all set!</div>
      <div style={styles.subtitle}>
        ArduinoBot is ready to help you build amazing projects.
        <br />
        Ask questions, generate code, and upload sketches right from here.
      </div>
      <button style={styles.primaryButton} onClick={onComplete}>
        Start Chatting
      </button>
    </div>
  );
};
