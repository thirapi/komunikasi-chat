export interface IHiddenMessageRepository {
  hide(userId: string, messageId: string): Promise<void>;
  /** Messages of a room this user hid after `since` (for delta sync). */
  hiddenSince(userId: string, roomId: string, since: Date): Promise<string[]>;
}
