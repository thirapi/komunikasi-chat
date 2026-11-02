import { IUserPrivacyRepository, PrivacySettings } from "../../repositories/user-privacy.repository.interface";

/** Read and change a user's last-seen / read-receipt visibility. */
export class PrivacySettingsUseCase {
  constructor(private repository: Pick<IUserPrivacyRepository, "getPrivacy" | "updatePrivacy">) {}

  get(userId: string): Promise<PrivacySettings> {
    return this.repository.getPrivacy(userId);
  }

  update(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const clean: Partial<PrivacySettings> = {};
    if (typeof patch?.showLastSeen === "boolean") clean.showLastSeen = patch.showLastSeen;
    if (typeof patch?.readReceipts === "boolean") clean.readReceipts = patch.readReceipts;
    return this.repository.updatePrivacy(userId, clean);
  }
}
