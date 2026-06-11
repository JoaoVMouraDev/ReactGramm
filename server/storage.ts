import "dotenv/config";
import { put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

function getStorageConfig() {
  const serviceUrl = ENV.storageApiUrl;
  const serviceKey = ENV.storageApiKey;
  const isLocal =
    !serviceKey ||
    serviceKey.includes("insira_aqui") ||
    serviceKey.includes("placeholder");

  console.log("[Storage] Config:", {
    hasUrl: Boolean(serviceUrl),
    mode: isLocal ? "LOCAL_DEV" : "REMOTE_STORAGE",
  });

  if (!isLocal && (!serviceUrl || !serviceKey)) {
    throw new Error("Storage config missing: set STORAGE_API_URL and STORAGE_API_KEY");
  }

  return {
    serviceUrl: serviceUrl.replace(/\/+$/, ""),
    serviceKey,
    isLocal,
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { serviceUrl, serviceKey, isLocal } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  if (ENV.vercelBlobToken || ENV.vercelBlobStoreId) {
    const body = typeof data === "string" ? data : Buffer.from(data);
    const blob = await put(key, body, {
      access: "public",
      contentType,
      ...(ENV.vercelBlobToken ? { token: ENV.vercelBlobToken } : {}),
    });
    return { key, url: blob.url };
  }

  if (isLocal) {
    if (ENV.isProduction) {
      const encoded = Buffer.from(data as any).toString("base64");
      return { key, url: `data:${contentType};base64,${encoded}` };
    }

    const storageDir = path.resolve(
      process.cwd(),
      "client",
      "public",
      "local-storage",
    );
    const fullPath = path.join(storageDir, key);

    if (!fs.existsSync(path.dirname(fullPath))) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }

    fs.writeFileSync(fullPath, Buffer.from(data as any));
    return { key, url: `/local-storage/${key}` };
  }

  const presignUrl = new URL("v1/storage/presign/put", `${serviceUrl}/`);
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: uploadUrl } = (await presignResp.json()) as { url: string };
  if (!uploadUrl) {
    throw new Error("Storage service returned an empty upload URL");
  }

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload failed (${uploadResp.status})`);
  }

  return { key, url: `/media/${key}` };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const { isLocal } = getStorageConfig();
  return { key, url: isLocal ? `/local-storage/${key}` : `/media/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { serviceUrl, serviceKey, isLocal } = getStorageConfig();
  const key = normalizeKey(relKey);

  if (isLocal) {
    return `/local-storage/${key}`;
  }

  const getUrl = new URL("v1/storage/presign/get", `${serviceUrl}/`);
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
