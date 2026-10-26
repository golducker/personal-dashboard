import { z } from "zod";
import { SOURCE_KINDS } from "@/db/schema";
import { MIME_FOLDER, MIME_SHEET, createDriveClient } from "./client";
import { sourceConfigSchema } from "./config";

export const PROFILE_VALUES = ["work", "mlsv", "study", "brain"] as const;
export const PROFILE_LABELS: Record<(typeof PROFILE_VALUES)[number], string> = {
  work: "Công việc",
  mlsv: "MLSV",
  study: "Học tập",
  brain: "Second brain",
};

export const createSourceSchema = z.object({
  googleId: z.string().min(10).max(200),
  kind: z.enum(SOURCE_KINDS),
  label: z.string().trim().min(1).max(80),
  profile: z.enum(PROFILE_VALUES),
  config: sourceConfigSchema.nullable(),
});

export const updateSourceSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  profile: z.enum(PROFILE_VALUES).optional(),
  config: sourceConfigSchema.nullable().optional(),
});

/** Checks the connected account can read `googleId` and classifies it. */
export async function inspectDriveId(googleId: string) {
  const client = createDriveClient();
  const file = await client.getFile(googleId);
  let kind: (typeof SOURCE_KINDS)[number] = "file";
  if (file.mimeType === MIME_FOLDER) {
    kind = googleId.startsWith("0A") && (await client.isSharedDrive(googleId)) ? "shared_drive" : "folder";
  } else if (file.mimeType === MIME_SHEET) {
    kind = "sheet";
  }
  return { googleId: file.id, kind, name: file.name, mimeType: file.mimeType };
}
