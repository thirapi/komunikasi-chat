import { UserRecord } from "@/lib/entities/models/user.model";
import { IUserRepository } from "../../repositories/user.repository.interface";

/** Profile fields a user may change about themselves. Anything else is dropped. */
const EDITABLE_FIELDS = ["username", "name", "avatar", "bio", "banner", "customStatus"] as const;
type EditableProfile = Pick<UserRecord, (typeof EDITABLE_FIELDS)[number]>;

export class UpdateUserUseCase {
  constructor(private userRepository: IUserRepository) {}
  async execute(userId: string, user: Partial<UserRecord>): Promise<void> {
    // Whitelist instead of passing the client's object straight to the
    // database, which allowed overwriting columns such as `password`.
    const data: Partial<EditableProfile> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in user) (data as Record<string, unknown>)[key] = user[key];
    }
    if (data.username !== undefined && !/^[a-zA-Z0-9_.-]{3,30}$/.test(data.username ?? "")) {
      throw new Error("Username 3–30 karakter: huruf, angka, titik, garis bawah, atau tanda hubung");
    }
    if (Object.keys(data).length === 0) return;
    await this.userRepository.update(userId, data);
  }
}
