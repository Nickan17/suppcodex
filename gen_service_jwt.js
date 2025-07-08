/**
 * Usage:  node gen_service_jwt.js [<ttl_seconds>]
 * Prints a signed HS256 token with role "service_role".
 *
 * Reads SUPABASE_JWT_SECRET from the .env.local file.
 */
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const secret = process.env.SUPABASE_JWT_SECRET;
const [, , ttl = "3600"] = process.argv;

if (!secret) {
  console.error(
    "Error: SUPABASE_JWT_SECRET is not defined." +
      '\nPlease ensure it is set in your ".env.local" file.'
  );
  process.exit(1);
}

const now = Math.floor(Date.now() / 1e3);
const token = jwt.sign(
  {
    iss: "supabase",
    ref: "uaqcehoocecvihubnbhp",
    role: "service_role",
    iat: now,
    exp: now + Number(ttl),
  },
  secret,
  { algorithm: "HS256" }
);

console.log(token);