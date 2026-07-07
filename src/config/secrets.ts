import * as vscode from "vscode";

const KEY_PREFIX = "arduinoBot";

export class SecretManager {
  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(providerId: string): Promise<string | undefined> {
    return this.secrets.get(`${KEY_PREFIX}.${providerId}.apiKey`);
  }

  async setApiKey(providerId: string, key: string): Promise<void> {
    await this.secrets.store(`${KEY_PREFIX}.${providerId}.apiKey`, key);
  }

  async deleteApiKey(providerId: string): Promise<void> {
    await this.secrets.delete(`${KEY_PREFIX}.${providerId}.apiKey`);
  }

  async getSearchApiKey(provider: string): Promise<string | undefined> {
    return this.secrets.get(`${KEY_PREFIX}.search.${provider}.apiKey`);
  }

  async setSearchApiKey(provider: string, key: string): Promise<void> {
    await this.secrets.store(`${KEY_PREFIX}.search.${provider}.apiKey`, key);
  }

  onDidChange(callback: (e: vscode.SecretStorageChangeEvent) => void): vscode.Disposable {
    return this.secrets.onDidChange(callback);
  }
}
