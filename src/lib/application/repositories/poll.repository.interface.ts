export interface PollInfo {
  id: string;
  messageId: string;
  roomId: string;
  allowMultiple: boolean;
  optionIds: string[];
  messageDeleted: boolean;
}

export interface IPollRepository {
  getPoll(pollId: string): Promise<PollInfo | null>;
  /** Replace the user's votes in this poll with exactly these options. */
  setVotes(pollId: string, userId: string, optionIds: string[]): Promise<void>;
}
