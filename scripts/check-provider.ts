/**
 * scripts/check-provider.ts
 * Operational compatibility probe for the OpenAI-compatible AI provider.
 * CRITICAL RULE: NEVER PRINT THE API KEY.
 */

const baseUrl = (process.env.AI_BASE_URL || "https://bandelbanget.xyz/v1").replace(/\/+$/, "");
const apiKey = process.env.AI_API_KEY || "";
const chatPath = process.env.AI_CHAT_PATH || "/chat/completions";
const modelsPath = process.env.AI_MODELS_PATH || "/models";
const defaultModel = process.env.AI_DEFAULT_MODEL || "auto";

console.log("==========================================");
console.log("   AI Provider Compatibility Probe");
console.log("==========================================");
console.log(`Base URL    : ${baseUrl}`);
console.log(`Chat Path   : ${chatPath}`);
console.log(`Models Path : ${modelsPath}`);
console.log(`API Key set : ${apiKey ? "YES (redacted)" : "NO"}`);
console.log("==========================================\n");

function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function probeModels() {
  console.log("1. Probing Models Endpoint...");
  const url = `${baseUrl}${modelsPath}`;
  try {
    const res = await fetch(url, { headers: getHeaders() });
    console.log(`   HTTP Status: ${res.status}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : json?.data;
      if (Array.isArray(list)) {
        console.log(`   SUCCESS: Found ${list.length} models.`);
        console.log(`   Sample models: ${list.slice(0, 5).map((m: { id?: string }) => m.id).join(", ")}`);
        return list[0]?.id || defaultModel;
      } else {
        console.log(`   WARNING: Non-standard response format. Preview: ${text.slice(0, 150)}`);
      }
    } catch {
      console.log(`   WARNING: Response is not JSON. Preview: ${text.slice(0, 150)}`);
    }
  } catch (err) {
    console.log(`   FAILED: ${(err as Error).message}`);
  }
  return defaultModel;
}

async function probeNonStreamingChat(modelId: string) {
  console.log(`\n2. Probing Non-Streaming Chat (${modelId})...`);
  const url = `${baseUrl}${chatPath}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Halo, jawab 'OK' saja." }],
        stream: false,
      }),
    });
    console.log(`   HTTP Status: ${res.status}`);
    const text = await res.text();
    if (res.ok) {
      console.log(`   SUCCESS: Response body preview: ${text.slice(0, 200)}`);
    } else {
      console.log(`   INFO: Provider returned status ${res.status}. Body preview: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`   FAILED: ${(err as Error).message}`);
  }
}

async function probeStreamingChat(modelId: string) {
  console.log(`\n3. Probing Streaming Chat (${modelId})...`);
  const url = `${baseUrl}${chatPath}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Katakan 'Halo Dunia'." }],
        stream: true,
      }),
    });
    console.log(`   HTTP Status: ${res.status}`);

    if (res.ok && res.body) {
      console.log("   SUCCESS: Stream connection opened. Reading initial chunks...");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let chunksReceived = 0;
      let sampleOutput = "";

      while (chunksReceived < 5) {
        const { done, value } = await reader.read();
        if (done) break;
        chunksReceived++;
        sampleOutput += decoder.decode(value, { stream: true });
      }
      reader.cancel();
      console.log(`   Received ${chunksReceived} chunk(s). Preview:\n${sampleOutput.slice(0, 250)}`);
    } else {
      const text = await res.text();
      console.log(`   INFO: Streaming endpoint returned status ${res.status}. Preview: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`   FAILED: ${(err as Error).message}`);
  }
}

async function run() {
  const model = await probeModels();
  await probeNonStreamingChat(model);
  await probeStreamingChat(model);
  console.log("\n==========================================");
  console.log("   Compatibility Probe Complete");
  console.log("==========================================");
}

run();
