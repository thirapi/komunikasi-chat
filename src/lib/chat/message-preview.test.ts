import { describe, it, expect } from "vitest";
import { attachmentLabel, messagePreview } from "./message-preview";

describe("attachmentLabel", () => {
  it("labels voice notes, photos, videos and files", () => {
    expect(attachmentLabel("https://cdn/x/pesan-suara.weba", "audio/webm")).toBe("🎤 Pesan suara");
    expect(attachmentLabel("https://cdn/x/a.m4a")).toBe("🎤 Pesan suara");
    expect(attachmentLabel("https://cdn/x/a.png")).toBe("📷 Foto");
    expect(attachmentLabel("https://cdn/x/a.mp4", "video/mp4")).toBe("🎬 Video");
    expect(attachmentLabel("https://cdn/x/a.pdf", "application/pdf")).toBe("📁 File");
  });

  it("prefers text when there is any", () => {
    expect(messagePreview({ content: "halo", attachments: [{ url: "a.png" }] })).toBe("halo");
    expect(messagePreview({ content: "", attachments: [{ url: "a.weba", fileType: "audio/webm" }] })).toBe("🎤 Pesan suara");
  });
});
