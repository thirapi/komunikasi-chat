export interface LinkPreviewDTO {
  url: string;
  title: string | null;
  description: string | null;
  /** Absolute image URL from the page (shown through the media proxy). */
  image: string | null;
  siteName: string | null;
}
