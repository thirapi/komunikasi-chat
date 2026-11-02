export interface SavedMessageDTO {
  messageId: string;
  roomId: string;
  roomName: string;
  isDirect: boolean;
  content: string;
  user: { username: string; name: string | null; avatar: string | null };
  createdAt: Date;
  savedAt: Date;
  attachmentType: string | null;
}
