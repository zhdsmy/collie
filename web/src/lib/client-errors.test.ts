import { i18n } from "@/i18n";

import { localizeClientError, type ClientErrorCode } from "./client-errors";

const FALLBACKS = {
  feedback_empty: "Nothing to send",
  feedback_input_not_open: "The feedback box didn't open",
  feedback_not_received: "The feedback didn't arrive",
  note_clear_failed: "Couldn't clear the existing note",
  note_input_not_closed: "The note input didn't close",
  note_input_not_open: "The note input didn't open",
  note_not_received: "The note text didn't arrive",
  reply_input_left_during_clear: "The input box left the screen",
  reply_message_not_received: "Message didn't reach the input box",
  reply_no_input_box: "The input box isn't on screen",
  reply_password_blocked: "The password prompt blocked the send",
  reply_password_typed: "The password was typed but not submitted",
  reply_submit_failed_after_typing: "Typed but not submitted",
} satisfies Record<ClientErrorCode, string>;

describe("client error localization", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it.each(["zh-CN", "zh-TW"])("translates every Collie-owned error in %s", async (language) => {
    await i18n.changeLanguage(language);
    for (const [clientError, fallback] of Object.entries(FALLBACKS)) {
      expect(
        localizeClientError({ clientError: clientError as ClientErrorCode, error: fallback }),
      ).not.toBe(fallback);
    }
  });

  it("leaves an unknown transport or proxy error verbatim", () => {
    expect(localizeClientError({ error: "proxy refused" })).toBe("proxy refused");
  });
});
