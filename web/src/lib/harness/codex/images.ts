import { draftCarriesSend } from "../../draft-match";

// Collie inserts absolute upload paths. Codex replaces image paths with atomic image tokens.
const UPLOAD_IMAGE = /(?:^|\s)(\/(?:[^\s/]+\/)*uploads\/[^\s/]+\.(?:gif|jpe?g|png|webp))(?=\s|$)/gi;
// The draft extractor folds terminal rows with spaces, including a wrap inside the token label.
const IMAGE_TOKEN = /\[\s*I\s*m\s*a\s*g\s*e\s*#\s*([1-9](?:\s*\d)*)\s*\]/g;

function caption(text: string): string {
  return text.split(UPLOAD_IMAGE).filter((_part, i) => i % 2 === 0)
    .flatMap((part) => part.split(IMAGE_TOKEN).filter((_p, i) => i % 2 === 0))
    .map((part) => part.trim()).filter(Boolean).join(" ");
}

/** Image tokens carry no file identity: count every image and retain ordered textual evidence.
 * An image-only send additionally needs the trusted empty input state immediately before typing. */
export function imageDraftCarriesSend(sent: string, draft: string, beforeDraft?: string | null): boolean {
  const paths = [...sent.matchAll(UPLOAD_IMAGE)].map((match) => match[1]!);
  if (paths.length === 0) return false;
  if (beforeDraft?.trim()) return false;
  const tokens = [...draft.matchAll(IMAGE_TOKEN)].map((match) => match[1]!.replace(/\s/g, ""));
  if (tokens.length === 0 || new Set(tokens).size !== tokens.length) return false;

  const remaining = [...paths];
  for (const match of draft.matchAll(UPLOAD_IMAGE)) {
    const index = remaining.indexOf(match[1]!);
    if (index < 0) return false;
    remaining.splice(index, 1);
  }
  if (tokens.length !== remaining.length) return false;

  const sentCaption = caption(sent);
  const draftCaption = caption(draft);
  if (!sentCaption) {
    return beforeDraft !== undefined && !beforeDraft?.trim() && !draftCaption;
  }
  return draftCarriesSend(sentCaption, draftCaption);
}
