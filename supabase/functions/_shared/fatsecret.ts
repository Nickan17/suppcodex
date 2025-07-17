import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// IMPROVED: Get credentials from environment with proper error handling
const id = Deno.env.get("FATSECRET_CLIENT_ID");
const sec = Deno.env.get("FATSECRET_CLIENT_SECRET");

// Check if credentials are available
const hasCredentials = id && sec;
const basic = hasCredentials ? encodeBase64(`${id}:${sec}`) : null;

let cache = { token: "", expires: 0 };

export async function getFSAccessToken(): Promise<string> {
  // IMPROVED: Check if credentials are available before attempting API call
  if (!hasCredentials || !basic) {
    throw new Error(
      "FatSecret credentials not configured - FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET must be set",
    );
  }

  if (Date.now() < cache.expires) return cache.token;

  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });

  if (!res.ok) {
    throw new Error(`FatSecret OAuth error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  cache = {
    token: json.access_token,
    expires: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cache.token;
}
