import { IPasswordService } from "@/lib/application/services/password.service.interface";
import { IUserRepository } from "../../repositories/user.repository.interface";

export class ChangePasswordUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordService: IPasswordService
  ) {}

  async execute(userId: string, data: { oldPassword?: string; newPassword: string }): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error("User not found");

    // The current password is always required. It used to be optional, which
    // let any caller set a new password for any account without knowing the
    // old one.
    if (!data.oldPassword) throw new Error("Masukkan kata sandi saat ini");
    // Same minimum as sign-up (sign-up-form.tsx).
    if (!data.newPassword || data.newPassword.length < 4) {
        throw new Error("Kata sandi baru minimal 4 karakter");
    }

    // Both calls must be awaited. They were not, which only type-checked
    // because the interface used to be synchronous; a Promise was compared
    // for truthiness and a Promise was written into the password column.
    const isMatch = await this.passwordService.comparePassword(data.oldPassword, user.password);
    if (!isMatch) throw new Error("Kata sandi saat ini salah");

    const hashedPassword = await this.passwordService.hashPassword(data.newPassword);
    await this.userRepository.update(userId, { password: hashedPassword });
  }
}
