import { i18n } from "@/i18n";

const CLIENT_ERROR_KEYS = {
  feedback_empty: "clientErrors.feedbackEmpty",
  feedback_input_not_open: "clientErrors.feedbackInputNotOpen",
  feedback_not_received: "clientErrors.feedbackNotReceived",
  note_clear_failed: "clientErrors.noteClearFailed",
  note_input_not_closed: "clientErrors.noteInputNotClosed",
  note_input_not_open: "clientErrors.noteInputNotOpen",
  note_not_received: "clientErrors.noteNotReceived",
  reply_input_left_during_clear: "clientErrors.replyInputLeftDuringClear",
  reply_message_not_received: "clientErrors.replyMessageNotReceived",
  reply_no_input_box: "clientErrors.replyNoInputBox",
  reply_password_blocked: "clientErrors.replyPasswordBlocked",
  reply_password_typed: "clientErrors.replyPasswordTyped",
  reply_submit_failed_after_typing: "apiErrors.submitFailedAfterTyping",
} as const;

export type ClientErrorCode = keyof typeof CLIENT_ERROR_KEYS;

export interface ClientError {
  error: string;
  /** Stable code for Collie-owned failures. Unknown transport/proxy errors have no code. */
  clientError?: ClientErrorCode;
}

/** Translate a Collie-owned client failure; unknown transport/proxy errors stay verbatim. */
export function localizeClientError(value: ClientError): string {
  return value.clientError ? i18n.t(CLIENT_ERROR_KEYS[value.clientError]) : value.error;
}
