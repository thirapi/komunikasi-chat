import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangePasswordUseCase } from "../change-password.use-case";
import { UpdateUserUseCase } from "../update.use-case";

const userRepository = {
  findById: vi.fn(),
  update: vi.fn(),
} as any;
const passwordService = {
  comparePassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("hashed"),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  userRepository.findById.mockResolvedValue({ id: "u1", password: "old-hash" });
  passwordService.hashPassword.mockResolvedValue("hashed");
});

describe("ChangePasswordUseCase", () => {
  const useCase = () => new ChangePasswordUseCase(userRepository, passwordService);

  it("requires the current password", async () => {
    await expect(useCase().execute("u1", { newPassword: "secret1" })).rejects.toThrow();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    passwordService.comparePassword.mockResolvedValue(false);
    await expect(useCase().execute("u1", { oldPassword: "nope", newPassword: "secret1" })).rejects.toThrow();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("changes the password when the current one matches", async () => {
    passwordService.comparePassword.mockResolvedValue(true);
    await useCase().execute("u1", { oldPassword: "right", newPassword: "secret1" });
    expect(userRepository.update).toHaveBeenCalledWith("u1", { password: "hashed" });
  });
});

describe("UpdateUserUseCase", () => {
  const useCase = () => new UpdateUserUseCase(userRepository);

  it("only writes editable profile fields", async () => {
    await useCase().execute("u1", { bio: "hai", password: "pwned", id: "u2" } as any);
    expect(userRepository.update).toHaveBeenCalledWith("u1", { bio: "hai" });
  });

  it("rejects an invalid username", async () => {
    await expect(useCase().execute("u1", { username: "a b" })).rejects.toThrow();
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
