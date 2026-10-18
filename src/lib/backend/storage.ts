import "server-only";
import sharp from "sharp";
import {
  DOCUMENT_IMAGE_MAX_SIDE,
  isUploadImageType,
  PHOTO_MAX_SIDE,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_LABEL,
} from "@/lib/media/photo-limits";
import type { UploadField } from "./providers/contract";

export type NormalizedUpload = {
  /** Random UUID name, the only shape the bucket and the media route accept. */
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
  contentType: "image/webp" | "application/pdf";
};

export const uploadFailed =
  "Upload failed. Check the connection and try again.";

/**
 * Validates and normalizes a board upload before any adapter stores it;
 * no route or UI responsibility. Null for an empty file input. Throws an
 * Error with a board-facing message.
 */
export async function normalizeUpload(
  field: UploadField,
  file: File,
): Promise<NormalizedUpload | null> {
  if (!file.size) return null;
  if (file.size > UPLOAD_MAX_BYTES)
    throw new Error(`Each upload must be ${UPLOAD_MAX_LABEL} or smaller.`);
  let bytes = new Uint8Array(await file.arrayBuffer());
  let extension: "webp" | "pdf";
  // A newsletter ("file") is a PDF or an image (review fixes P3); an image
  // stays sharp enough to read: the longer side up to DOCUMENT_IMAGE_MAX_SIDE.
  const image =
    field === "image" || (field === "file" && isUploadImageType(file.type));
  if (image) {
    if (!isUploadImageType(file.type))
      throw new Error("Use a JPEG, PNG, or WebP image.");
    const side = field === "file" ? DOCUMENT_IMAGE_MAX_SIDE : PHOTO_MAX_SIDE;
    try {
      bytes = new Uint8Array(
        await sharp(bytes, { limitInputPixels: 24000000 })
          .rotate()
          .resize({
            width: side,
            height: side,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer(),
      );
    } catch {
      throw new Error(
        "This image could not be read. Choose a valid JPEG, PNG, or WebP.",
      );
    }
    extension = "webp";
  } else {
    if (
      file.type !== "application/pdf" ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
    )
      throw new Error("Choose a PDF, or a JPEG, PNG or WebP image.");
    extension = "pdf";
  }
  return {
    name: crypto.randomUUID() + "." + extension,
    bytes,
    contentType: extension === "pdf" ? "application/pdf" : "image/webp",
  };
}
