"use server";

import {
  AuthenticationError,
  InputParsedError,
} from "@/lib/entities/errors/common";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { SignUpUserDTO } from "@/lib/entities/models/user.model";
import { SessionDTO } from "@/lib/entities/models/session.model";
import { signInController } from "@/lib/interface-adapters/controllers/sign-in.controller";
import { signUpController } from "@/lib/interface-adapters/controllers/sign-up.controller";
import { getUserSessionController } from "@/lib/interface-adapters/controllers/get-session.controller";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { signOutController } from "@/lib/interface-adapters/controllers/sign-out.controller";
import { getUserWithRolesController } from "@/lib/interface-adapters/controllers/roles/get-user-role.controller";
import { NextRequest } from "next/server";
import { parseDeviceInfo } from "@/lib/device-info";

const getContext = async () => {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for") || "unknown";
  const userAgent = headerList.get("user-agent") || "unknown";
  const device = userAgent !== "unknown" ? parseDeviceInfo(userAgent) : undefined;
  return { ip, userAgent, device };
};

const getGeolocation = async (ip: string): Promise<Record<string, any> | null> => {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,region,country,query`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return { city: data.city, region: data.region, country: data.country };
  } catch {
    return null;
  }
};

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const DEFAULT_AFTER_AUTH = "/channels/default";

/**
 * Only same-origin paths. "//evil.com" and "/\\evil.com" also start with "/"
 * but browsers treat them as protocol-relative URLs to another host, which
 * turned callbackUrl into an open redirect.
 */
const safeCallbackUrl = (callbackUrl?: string): string => {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//") ||
    callbackUrl.startsWith("/\\")
  ) {
    return DEFAULT_AFTER_AUTH;
  }
  return callbackUrl;
};

/**
 * Verify credentials, create the session and set the cookie.
 *
 * Geolocation used to be awaited here before the password was even checked,
 * adding up to 3s (an external HTTP call) to every login. It is now passed as
 * lazy metadata and resolved inside the deferred audit-log write, after the
 * response has gone out.
 */
const startSession = async (username: string, password: string) => {
  const context = await getContext();
  const metadata = async () => {
    const geo = await getGeolocation(context.ip);
    return {
      ...(context.device ? { device: context.device } : {}),
      ...(geo ? { location: geo } : {}),
    };
  };

  const token = await signInController(
    { username, password },
    { ip: context.ip, userAgent: context.userAgent, metadata }
  );
  if (!token) throw new AuthenticationError("Error creating session!");

  (await cookies()).set("session_id", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
};

const toErrorResponse = (err: any): ServerResponse<null> => {
  if (err instanceof AuthenticationError) {
    return { status: "error", data: null, error: { message: err.message, type: err.name } };
  }
  if (err instanceof InputParsedError) {
    return {
      status: "error",
      data: null,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
  console.error(err);
  return {
    status: "error",
    data: null,
    error: { message: "Terjadi kesalahan. Coba lagi.", type: "UNKNOWN_ERROR" },
  };
};

export const signInUser = async (
  username: string,
  password: string,
  callbackUrl?: string
): Promise<ServerResponse<null>> => {
  try {
    await startSession(username, password);
  } catch (err) {
    return toErrorResponse(err);
  }
  // Outside the try: redirect() works by throwing.
  redirect(safeCallbackUrl(callbackUrl));
};

export const signUpUser = async (
  username: string,
  password: string,
  confirm_password: string,
  callbackUrl?: string
): Promise<ServerResponse<null>> => {
  try {
    const signUpData: SignUpUserDTO = { username, password, confirm_password };
    await signUpController(signUpData);
    // Sign the new account straight in instead of sending the user back to
    // the login form to type the same credentials again.
    await startSession(username, password);
  } catch (err) {
    return toErrorResponse(err);
  }
  redirect(safeCallbackUrl(callbackUrl));
};

export const signOutUserAction = async () => {
  const cookieStore = await cookies();
  const session_id = cookieStore.get("session_id");
  if (!session_id) {
    return null;
  }
  const context = await getContext();
  const metadata: Record<string, any> = {};
  if (context.device) metadata.device = context.device;
  await signOutController(session_id.value, { ip: context.ip, userAgent: context.userAgent, metadata });
  cookieStore.delete("session_id");
  redirect("/");
};

export const getUserSession = cache(async (): Promise<SessionDTO | null> => {
  const session_id = (await cookies()).get("session_id");
  if (!session_id) {
    return null;
  }
  const context = await getContext();
  const metadata: Record<string, any> = {};
  if (context.device) metadata.device = context.device;
  const response = await getUserSessionController(session_id.value, { ip: context.ip, userAgent: context.userAgent, metadata });
  if (response.session) {
    return response;
  } else {
    return null;
  }
});

const getUserWithRolesForSession = cache(async () => {
  const session = await getUserSession();
  return getUserWithRolesController(session);
});

export const sidaBarUserInfo = async () => {
  const session = await getUserSession();

  const userData = await getUserWithRolesForSession();

  const getRolesAsString = (roles: { id: string; name: string }[]): string => {
    return roles.map((role) => role.name).join(", ");
  };

  if (session && userData) {
    return {
      name: userData.name || userData.username,
      username: userData.username,
      role: getRolesAsString(userData.roles),
      email: "komunikasi.qzz.io",
      avatar: userData.avatar || "/avatars/avatar1.png",
      bio: userData.bio,
      banner: userData.banner,
      customStatus: userData.customStatus,
    };
  } else {
    return {
      name: "error",
      username: "error",
      role: "",
      email: "",
      avatar: "/avatars/avatar1.png",
    };
  }
};

export const getUserWithRolesFromSession = async () => {
  const userWithRoles = await getUserWithRolesForSession();

  return userWithRoles;
};

export async function getUserSessionFromRequest(
  req: NextRequest
): Promise<SessionDTO | null> {
  const session_id = req.cookies.get("session_id")?.value;

  if (!session_id) return null;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const device = userAgent !== "unknown" ? parseDeviceInfo(userAgent) : undefined;
  const metadata: Record<string, any> = {};
  if (device) metadata.device = device;

  const response = await getUserSessionController(session_id, { ip, userAgent, metadata });
  return response ?? null;
}
