import { describe, it, expect, vi } from "vitest";
import { preparePoll, VotePollUseCase, MAX_POLL_OPTIONS, pollMessageContent } from "../polls.use-case";

describe("preparePoll", () => {
  it("trims, drops empty and duplicate options", () => {
    expect(preparePoll({ question: "  Makan  di mana? ", options: ["Warteg", " warteg ", "", "Padang"], allowMultiple: false })).toEqual({
      question: "Makan di mana?",
      options: ["Warteg", "Padang"],
      allowMultiple: false,
    });
  });

  it("needs a question and at least two different options, at most the limit", () => {
    expect(() => preparePoll({ question: "", options: ["a", "b"], allowMultiple: false })).toThrow();
    expect(() => preparePoll({ question: "q", options: ["a", "A"], allowMultiple: false })).toThrow(/minimal 2/);
    const many = Array.from({ length: MAX_POLL_OPTIONS + 1 }, (_, i) => `o${i}`);
    expect(() => preparePoll({ question: "q", options: many, allowMultiple: true })).toThrow(/Maksimal/);
  });

  it("labels the message for previews and search", () => {
    expect(pollMessageContent("Rapat jam berapa?")).toBe("📊 Rapat jam berapa?");
  });
});

describe("VotePollUseCase", () => {
  function setup(opts: { allowMultiple?: boolean; member?: boolean; deleted?: boolean } = {}) {
    const polls = {
      getPoll: vi.fn().mockResolvedValue({
        id: "p1", messageId: "m1", roomId: "r1", allowMultiple: opts.allowMultiple ?? false,
        optionIds: ["a", "b", "c"], messageDeleted: opts.deleted ?? false,
      }),
      setVotes: vi.fn(),
    };
    const rooms = { getRoomAccess: vi.fn().mockResolvedValue({ isMember: opts.member ?? true }) };
    const messages = { getMessageById: vi.fn().mockResolvedValue({ id: "m1", poll: {} }), touchMessage: vi.fn() };
    const pusher = { trigger: vi.fn() };
    return { uc: new VotePollUseCase(polls, rooms as any, messages as any, pusher), polls, messages, pusher };
  }

  it("records the vote, bumps the message and broadcasts it", async () => {
    const { uc, polls, messages, pusher } = setup();
    await uc.execute("u1", "p1", ["b"]);
    expect(polls.setVotes).toHaveBeenCalledWith("p1", "u1", ["b"]);
    expect(messages.touchMessage).toHaveBeenCalledWith("m1");
    expect(pusher.trigger).toHaveBeenCalledWith(expect.stringContaining("r1"), "message-updated", { id: "m1", poll: {} });
  });

  it("allows withdrawing a vote with an empty selection", async () => {
    const { uc, polls } = setup();
    await uc.execute("u1", "p1", []);
    expect(polls.setVotes).toHaveBeenCalledWith("p1", "u1", []);
  });

  it("enforces single choice, valid options, membership and live polls", async () => {
    await expect(setup().uc.execute("u1", "p1", ["a", "b"])).rejects.toThrow(/satu pilihan/);
    await expect(setup({ allowMultiple: true }).uc.execute("u1", "p1", ["a", "b"])).resolves.toBeTruthy();
    await expect(setup().uc.execute("u1", "p1", ["zzz"])).rejects.toThrow(/tidak valid/);
    await expect(setup({ member: false }).uc.execute("u1", "p1", ["a"])).rejects.toThrow();
    await expect(setup({ deleted: true }).uc.execute("u1", "p1", ["a"])).rejects.toThrow();
  });
});
