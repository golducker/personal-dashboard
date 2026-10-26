import { googleFetch } from "@/lib/google";

export const MIME_FOLDER = "application/vnd.google-apps.folder";
export const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
export const MIME_SHORTCUT = "application/vnd.google-apps.shortcut";

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  webViewLink?: string;
  trashed?: boolean;
  shortcutDetails?: { targetId: string; targetMimeType: string };
};

export type DriveChange = { fileId: string; removed: boolean; file?: DriveFile };

export type ChangesPage = {
  changes: DriveChange[];
  nextPageToken?: string;
  newStartPageToken?: string;
};

/** Performs an authenticated GET and returns parsed JSON. Injected so tests can mock the network. */
export type JsonGetter = (url: string) => Promise<unknown>;

const defaultGet: JsonGetter = (url) => googleFetch<unknown>(url);

const FILE_FIELDS = "id,name,mimeType,parents,modifiedTime,webViewLink,trashed,shortcutDetails(targetId,targetMimeType)";
const SHARED = { supportsAllDrives: "true", includeItemsFromAllDrives: "true" };

function url(base: string, params: Record<string, string | undefined>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

/** Quotes a sheet tab title for A1 notation. */
export function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export function createDriveClient(get: JsonGetter = defaultGet) {
  async function listAll(params: Record<string, string>): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const data = (await get(
        url(`${DRIVE}/files`, {
          ...SHARED,
          ...params,
          pageSize: "1000",
          fields: `nextPageToken,files(${FILE_FIELDS})`,
          pageToken,
        }),
      )) as { files?: DriveFile[]; nextPageToken?: string };
      out.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }

  return {
    /** Direct, non-trashed children of a folder (all pages). */
    listChildren(folderId: string): Promise<DriveFile[]> {
      return listAll({ q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false` });
    },

    /** Every non-trashed file of a shared drive (all pages, flat). */
    listSharedDrive(driveId: string): Promise<DriveFile[]> {
      return listAll({ corpora: "drive", driveId, q: "trashed = false" });
    },

    async getFile(id: string): Promise<DriveFile> {
      return (await get(url(`${DRIVE}/files/${encodeURIComponent(id)}`, { ...SHARED, fields: FILE_FIELDS }))) as DriveFile;
    },

    /** True when `id` is a shared drive (drives.get succeeds). */
    async isSharedDrive(id: string): Promise<boolean> {
      try {
        await get(url(`${DRIVE}/drives/${encodeURIComponent(id)}`, { fields: "id" }));
        return true;
      } catch {
        return false;
      }
    },

    async getStartPageToken(driveId?: string): Promise<string> {
      const data = (await get(
        url(`${DRIVE}/changes/startPageToken`, { supportsAllDrives: "true", driveId }),
      )) as { startPageToken: string };
      return data.startPageToken;
    },

    /** One page of changes. Pass `driveId` for a shared drive feed; omit it for the user's own feed. */
    async listChanges(pageToken: string, driveId?: string): Promise<ChangesPage> {
      const data = (await get(
        url(`${DRIVE}/changes`, {
          ...SHARED,
          pageToken,
          driveId,
          includeRemoved: "true",
          pageSize: "200",
          fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS}))`,
        }),
      )) as { changes?: { fileId: string; removed?: boolean; file?: DriveFile }[]; nextPageToken?: string; newStartPageToken?: string };
      return {
        changes: (data.changes ?? []).map((c) => ({ fileId: c.fileId, removed: !!c.removed, file: c.file })),
        nextPageToken: data.nextPageToken,
        newStartPageToken: data.newStartPageToken,
      };
    },

    /** Tab titles of a spreadsheet, in sheet order. */
    async getSpreadsheetTitles(spreadsheetId: string): Promise<string[]> {
      const data = (await get(
        url(`${SHEETS}/${encodeURIComponent(spreadsheetId)}`, { fields: "sheets.properties.title" }),
      )) as { sheets?: { properties?: { title?: string } }[] };
      return (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
    },

    /** Cell text (as displayed) of whole tabs, keyed by tab title. */
    async batchGetValues(spreadsheetId: string, tabs: string[]): Promise<Record<string, string[][]>> {
      if (tabs.length === 0) return {};
      const u = new URL(`${SHEETS}/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
      for (const t of tabs) u.searchParams.append("ranges", quoteTab(t));
      u.searchParams.set("majorDimension", "ROWS");
      u.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
      const data = (await get(u.toString())) as { valueRanges?: { values?: unknown[][] }[] };
      const out: Record<string, string[][]> = {};
      tabs.forEach((t, i) => {
        out[t] = (data.valueRanges?.[i]?.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
      });
      return out;
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;

/** Deep link to open a file in Google's own UI. */
export function fileUrl(id: string, mimeType: string): string {
  if (mimeType === MIME_SHEET) return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  if (mimeType === "application/vnd.google-apps.document") return `https://docs.google.com/document/d/${id}/edit`;
  if (mimeType === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${id}/edit`;
  if (mimeType === MIME_FOLDER) return `https://drive.google.com/drive/folders/${id}`;
  return `https://drive.google.com/file/d/${id}/view`;
}

/** Pulls the Drive/Sheets/Docs file or folder ID out of a pasted link (or accepts a bare ID). */
export function extractDriveId(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return text;
  const m =
    text.match(/\/(?:folders|d|drives)\/([A-Za-z0-9_-]{10,})/) ?? text.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
