/** Block relation between the viewer and one other user. */
export interface BlockStatus {
  /** The viewer blocked them. */
  iBlocked: boolean;
  /** They blocked the viewer. */
  blockedMe: boolean;
}
