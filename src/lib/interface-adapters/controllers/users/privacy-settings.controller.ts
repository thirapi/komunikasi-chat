import { db } from "@/lib/db";
import { UserPrivacyRepository } from "@/lib/infrastructure/repositories/user-privacy.repository";
import { PrivacySettingsUseCase } from "@/lib/application/use-cases/users/privacy-settings.use-case";

const privacySettingsUseCase = new PrivacySettingsUseCase(new UserPrivacyRepository(db));

export async function getPrivacyController(userId: string) {
  return privacySettingsUseCase.get(userId);
}

export async function updatePrivacyController(userId: string, patch: { showLastSeen?: boolean; readReceipts?: boolean }) {
  return privacySettingsUseCase.update(userId, patch);
}
