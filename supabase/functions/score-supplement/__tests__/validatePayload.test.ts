import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "../index.ts";

Deno.test("happy path - valid payload returns 200", async () => {
  const mockBody = {
    data: {
      parsed: {
        title: "Test Product",
        ingredients_raw: ["Ingredient 1 100mg", "Ingredient 2 200mg"],
        numeric_doses_present: true
      }
    },
    scraped: null
  };

  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(mockBody),
    headers: new Headers({ "Content-Type": "application/json" })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
});

Deno.test("missing parsed - returns 400 with error", async () => {
  const mockBody = {
    data: {}
  };

  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(mockBody),
    headers: new Headers({ "Content-Type": "application/json" })
  });

  const res = await handler(req);
  assertEquals(res.status, 400);

  const json = await res.json();
  assertEquals(json.error, "Invalid payload: data.parsed is required");
}); 