import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInUser, signUpUser, signOutUserAction } from "../auth.action";
import { signInController } from "@/lib/interface-adapters/controllers/sign-in.controller";
import { signUpController } from "@/lib/interface-adapters/controllers/sign-up.controller";
import { signOutController } from "@/lib/interface-adapters/controllers/sign-out.controller";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AuthenticationError, InputParsedError } from "@/lib/entities/errors/common";

vi.mock("@/lib/interface-adapters/controllers/sign-in.controller", () => ({
  signInController: vi.fn(),
}));

vi.mock("@/lib/interface-adapters/controllers/sign-up.controller", () => ({
  signUpController: vi.fn(),
}));

vi.mock("@/lib/interface-adapters/controllers/sign-out.controller", () => ({
  signOutController: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
  headers: vi.fn(() =>
    Promise.resolve({
      get: (key: string) => {
        if (key === "x-forwarded-for") return "127.0.0.1";
        if (key === "user-agent") return "unknown";
        return null;
      },
    })
  ),
}));

describe("auth.action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signUpUser", () => {
    it("signs the new account in and redirects to /channels/default", async () => {
      vi.mocked(signUpController).mockResolvedValueOnce(undefined as any);
      vi.mocked(signInController).mockResolvedValueOnce("new_session");
      await signUpUser("testuser", "password123", "password123");
      expect(signInController).toHaveBeenCalledWith(
        { username: "testuser", password: "password123" },
        expect.any(Object)
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "session_id",
        "new_session",
        expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
      );
      expect(redirect).toHaveBeenCalledWith("/channels/default");
    });

    it("redirects to callbackUrl after sign-up", async () => {
      vi.mocked(signUpController).mockResolvedValueOnce(undefined as any);
      vi.mocked(signInController).mockResolvedValueOnce("new_session");
      await signUpUser("testuser", "password123", "password123", "/dashboard");
      expect(redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("returns error on AuthenticationError", async () => {
      vi.mocked(signUpController).mockRejectedValueOnce(
        new AuthenticationError("User already exists")
      );
      const res = await signUpUser("testuser", "pass", "pass");
      expect(res).toEqual({
        status: "error",
        data: null,
        error: { message: "User already exists", type: "Error" },
      });
    });

    it("returns error on InputParsedError", async () => {
      vi.mocked(signUpController).mockRejectedValueOnce(
        new InputParsedError("Invalid input", { username: ["Too short"] })
      );
      const res = await signUpUser("ab", "pass", "pass");
      expect(res).toEqual({
        status: "error",
        data: null,
        error: {
          message: "Invalid input",
          type: "InputParsedError",
          meta: { username: "Too short" },
        },
      });
    });
  });

  describe("signInUser", () => {
    it("sets session_id cookie and redirects to /channels/default by default", async () => {
      vi.mocked(signInController).mockResolvedValueOnce("session_token_123");
      await signInUser("user", "pass");
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "session_id",
        "session_token_123",
        expect.objectContaining({ httpOnly: true })
      );
      expect(redirect).toHaveBeenCalledWith("/channels/default");
    });

    it("redirects to callbackUrl when valid relative path", async () => {
      vi.mocked(signInController).mockResolvedValueOnce("session_token_123");
      await signInUser("user", "pass", "/custom-path");
      expect(redirect).toHaveBeenCalledWith("/custom-path");
    });

    it.each(["//evil.com", "/\\evil.com", "https://evil.com"])(
      "ignores off-site callbackUrl %s",
      async (url) => {
        vi.mocked(signInController).mockResolvedValueOnce("session_token_123");
        await signInUser("user", "pass", url);
        expect(redirect).toHaveBeenCalledWith("/channels/default");
      }
    );

    it("does not redirect on failed credentials", async () => {
      vi.mocked(signInController).mockRejectedValueOnce(
        new AuthenticationError("Username atau password salah")
      );
      const res = await signInUser("user", "wrong");
      expect(res.status).toBe("error");
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns error if signInController returns falsy", async () => {
      vi.mocked(signInController).mockResolvedValueOnce(null as any);
      const res = await signInUser("user", "pass");
      expect(res.status).toBe("error");
    });
  });

  describe("signOutUserAction", () => {
    it("returns null if no session_id cookie exists", async () => {
      mockCookieStore.get.mockReturnValueOnce(undefined);
      const res = await signOutUserAction();
      expect(res).toBeNull();
    });

    it("calls signOutController, deletes cookie and redirects to /", async () => {
      mockCookieStore.get.mockReturnValueOnce({ value: "sess_123" });
      vi.mocked(signOutController).mockResolvedValueOnce(undefined as any);
      await signOutUserAction();
      expect(signOutController).toHaveBeenCalledWith("sess_123", expect.any(Object));
      expect(mockCookieStore.delete).toHaveBeenCalledWith("session_id");
      expect(redirect).toHaveBeenCalledWith("/");
    });
  });
});
