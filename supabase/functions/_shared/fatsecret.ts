import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const id  = Deno.env.get("FATSECRET_CLIENT_ID")!;
const sec = Deno.env.get("FATSECRET_CLIENT_SECRET")!;
const basic = encodeBase64(`${id}:${sec}`);

let cache = { token: "", expires: 0 };

export async function getFSAccessToken(): Promise<string> {
  if (Date.now() < cache.expires) return cache.token;
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });
  const json = await res.json();
  cache = {
    token: json.access_token,
    expires: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cache.token;
}