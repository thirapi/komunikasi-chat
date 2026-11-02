import { roomChannel } from "@/lib/pusher/channels";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import type { NewPoll, IMessageRepository } from "../../repositories/message.repository.interface";
import { IPollRepository } from "../../repositories/poll.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/** WhatsApp allows 12 options, Telegram 10. */
export const MAX_POLL_OPTIONS = 10;

export class PollError extends Error {}

/** Clean and validate a new poll; the message itself goes through SendMessageUseCase. */
export function preparePoll(input: { question: string; options: string[]; allowMultiple: boolean }): NewPoll {
  const question = (input.question ?? "").replace(/\s+/g, " ").trim();
  if (!question) throw new PollError("Pertanyaan tidak boleh kosong");
  if (question.length > 300) throw new PollError("Pertanyaan terlalu panjang");
  const seen = new Set<string>();
  const options: string[] = [];
  for (const raw of input.options ?? []) {
    const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    options.push(text);
  }
  if (options.length < 2) throw new PollError("Isi minimal 2 pilihan yang berbeda");
  if (options.length > MAX_POLL_OPTIONS) throw new PollError(`Maksimal ${MAX_POLL_OPTIONS} pilihan`);
  return { question, options, allowMultiple: !!input.allowMultiple };
}

/** The message text for a poll: what previews, notifications and search show. */
export const pollMessageContent = (question: string) => `📊 ${question}`;

/**
 * Vote in a poll: votes are visible to the room (WhatsApp; Telegram's default
 * is anonymous), can be changed or withdrawn (empty selection), single choice
 * unless the poll allows several. Everyone sees the new counts live through
 * the existing message-updated event.
 */
export class VotePollUseCase {
  constructor(
    private pollRepository: IPollRepository,
    private roomRepository: Pick<IRoomRepository, "getRoomAccess">,
    private messageRepository: Pick<IMessageRepository, "getMessageById" | "touchMessage">,
    private pusherService: Pick<IPusherService, "trigger">,
  ) {}

  async execute(userId: string, pollId: string, optionIds: string[]): Promise<MessageWithUserDTO> {
    const poll = await this.pollRepository.getPoll(pollId);
    if (!poll || poll.messageDeleted) throw new PollError("Polling tidak ditemukan");
    const access = await this.roomRepository.getRoomAccess(poll.roomId, userId);
    if (!access.isMember) throw new PollError("Kamu bukan anggota room ini");

    const chosen = [...new Set(optionIds)];
    if (chosen.some((id) => !poll.optionIds.includes(id))) throw new PollError("Pilihan tidak valid");
    if (!poll.allowMultiple && chosen.length > 1) throw new PollError("Polling ini hanya satu pilihan");

    await this.pollRepository.setVotes(pollId, userId, chosen);
    await this.messageRepository.touchMessage(poll.messageId);
    const message = await this.messageRepository.getMessageById(poll.messageId);
    if (!message) throw new PollError("Polling tidak ditemukan");
    await this.pusherService.trigger(roomChannel(poll.roomId), "message-updated", message);
    return message;
  }
}
