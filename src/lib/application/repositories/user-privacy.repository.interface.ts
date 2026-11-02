export interface PrivacySettings {
  showLastSeen: boolean;
  readReceipts: boolean;
}

export interface IUserPrivacyRepository {
  getPrivacy(userId: string): Promise<PrivacySettings>;
  updatePrivacy(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings>;
  touchLastSeen(userId: string, at: Date): Promise<void>;
}
