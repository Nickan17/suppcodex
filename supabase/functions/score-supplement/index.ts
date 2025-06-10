/// <reference lib="deno.ns" />

export default async function (_req: Request): Promise<Response> {
  return new Response("OK", { status: 200 });
}
