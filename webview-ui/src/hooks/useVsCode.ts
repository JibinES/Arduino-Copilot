import { useCallback } from "react";
import { getVsCodeApi } from "../vscode-api";

export function useVsCode() {
  const api = getVsCodeApi();

  const postMessage = useCallback(
    (message: unknown) => {
      api.postMessage(message);
    },
    [api],
  );

  const sendMessage = useCallback(
    (text: string) => {
      api.postMessage({ type: "sendMessage", text });
    },
    [api],
  );

  const cancelRequest = useCallback(() => {
    api.postMessage({ type: "cancelRequest" });
  }, [api]);

  const setProvider = useCallback(
    (providerId: string) => {
      api.postMessage({ type: "setProvider", providerId });
    },
    [api],
  );

  const setModel = useCallback(
    (model: string) => {
      api.postMessage({ type: "setModel", model });
    },
    [api],
  );

  const setApiKey = useCallback(
    (providerId: string, key: string) => {
      api.postMessage({ type: "setApiKey", providerId, key });
    },
    [api],
  );

  const setSearchApiKey = useCallback(
    (provider: string, key: string) => {
      api.postMessage({ type: "setSearchApiKey", provider, key });
    },
    [api],
  );

  const approvalResponse = useCallback(
    (id: string, approved: boolean) => {
      api.postMessage({ type: "approvalResponse", id, approved });
    },
    [api],
  );

  const setBaseUrl = useCallback(
    (providerId: string, url: string) => {
      api.postMessage({ type: "setBaseUrl", providerId, url });
    },
    [api],
  );

  const openSettings = useCallback(() => {
    api.postMessage({ type: "openSettings" });
  }, [api]);

  const listModels = useCallback(() => {
    api.postMessage({ type: "listModels" });
  }, [api]);

  return {
    postMessage,
    sendMessage,
    cancelRequest,
    setProvider,
    setModel,
    setApiKey,
    setSearchApiKey,
    setBaseUrl,
    approvalResponse,
    openSettings,
    listModels,
  };
}
