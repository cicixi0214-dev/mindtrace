import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "mindtrace-default-secret-change-me"
);
const COOKIE_NAME = "session";

export async function createSession(): Promise<string> {
  return await new SignJWT({ authed: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(): Promise<boolean> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return false;
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export function verifyPassword(input: string): boolean {
  const envPassword = process.env.APP_PASSWORD;
  if (!envPassword) return true; // no password set = open access
  return input === envPassword;
}

export function getPublicVars(): Record<string, string> {
  return {
    HAS_PASSWORD: process.env.APP_PASSWORD ? "true" : "false",
  };
}
