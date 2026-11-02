import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/lib/infrastructure/drizzle/schema";
import { IUserPrivacyRepository, PrivacySettings } from "@/lib/application/repositories/user-privacy.repository.interface";

export class UserPrivacyRepository implements IUserPrivacyRepository {
  constructor(private client: typeof db) {}

  async getPrivacy(userId: string): Promise<PrivacySettings> {
    const row = await this.client.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { showLastSeen: true, readReceipts: true },
    });
    return { showLastSeen: row?.showLastSeen ?? true, readReceipts: row?.readReceipts ?? true };
  }

  async updatePrivacy(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const set: Partial<PrivacySettings> = {};
    if (typeof patch.showLastSeen === "boolean") set.showLastSeen = patch.showLastSeen;
    if (typeof patch.readReceipts === "boolean") set.readReceipts = patch.readReceipts;
    if (Object.keys(set).length > 0) await this.client.update(users).set(set).where(eq(users.id, userId));
    return this.getPrivacy(userId);
  }

  async touchLastSeen(userId: string, at: Date): Promise<void> {
    await this.client.update(users).set({ lastSeenAt: at }).where(eq(users.id, userId));
  }
}
