// NOTE: [thought process] Convention: system sender IDs use __name__ format (e.g. __system__,
// __eliza__). This lets any room detect non-human messages with a single check.
export function isSystemMessage(senderId: string): boolean {
  return senderId.startsWith('__') && senderId.endsWith('__');
}
