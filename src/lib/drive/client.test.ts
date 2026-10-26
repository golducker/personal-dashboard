import { describe, expect, it } from "vitest";
import { createDriveClient, extractDriveId, quoteTab, type JsonGetter } from "./client";

function mock(responses: unknown[]) {
  const urls: URL[] = [];
  const get: JsonGetter = async (u) => {
    urls.push(new URL(u));
    return responses.shift();
  };
  return { client: createDriveClient(get), urls };
}

describe("drive client", () => {
  it("pages through files.list with shared-drive flags", async () => {
    const { client, urls } = mock([
      { files: [{ id: "a", name: "A", mimeType: "x" }], nextPageToken: "p2" },
      { files: [{ id: "b", name: "B", mimeType: "x" }] },
    ]);
    const out = await client.listChildren("FOLDER");
    expect(out.map((f) => f.id)).toEqual(["a", "b"]);
    expect(urls[0].searchParams.get("q")).toBe("'FOLDER' in parents and trashed = false");
    expect(urls[0].searchParams.get("supportsAllDrives")).toBe("true");
    expect(urls[0].searchParams.get("includeItemsFromAllDrives")).toBe("true");
    expect(urls[0].searchParams.get("fields")).toContain("shortcutDetails");
    expect(urls[1].searchParams.get("pageToken")).toBe("p2");
  });

  it("lists a whole shared drive", async () => {
    const { client, urls } = mock([{ files: [] }]);
    await client.listSharedDrive("0ADRIVE");
    expect(urls[0].searchParams.get("corpora")).toBe("drive");
    expect(urls[0].searchParams.get("driveId")).toBe("0ADRIVE");
  });

  it("gets start tokens and changes, with driveId only when given", async () => {
    const { client, urls } = mock([
      { startPageToken: "t1" },
      { startPageToken: "t2" },
      { changes: [{ fileId: "x", removed: true }], newStartPageToken: "t3" },
    ]);
    expect(await client.getStartPageToken()).toBe("t1");
    expect(urls[0].searchParams.has("driveId")).toBe(false);
    expect(await client.getStartPageToken("0ADRIVE")).toBe("t2");
    expect(urls[1].searchParams.get("driveId")).toBe("0ADRIVE");
    const page = await client.listChanges("t2", "0ADRIVE");
    expect(page.changes).toEqual([{ fileId: "x", removed: true, file: undefined }]);
    expect(page.newStartPageToken).toBe("t3");
    expect(urls[2].searchParams.get("driveId")).toBe("0ADRIVE");
    expect(urls[2].searchParams.get("includeRemoved")).toBe("true");
  });

  it("reads tab titles and batches values in request order", async () => {
    const { client, urls } = mock([
      { sheets: [{ properties: { title: "One" } }, { properties: { title: "Two's" } }] },
      { valueRanges: [{ values: [["a", 1]] }, {}] },
    ]);
    expect(await client.getSpreadsheetTitles("SHEET")).toEqual(["One", "Two's"]);
    const values = await client.batchGetValues("SHEET", ["One", "Two's"]);
    expect(values).toEqual({ One: [["a", "1"]], "Two's": [] });
    expect(urls[1].searchParams.getAll("ranges")).toEqual(["'One'", "'Two''s'"]);
    expect(urls[1].pathname).toContain("values:batchGet");
  });

  it("skips the request when there are no tabs", async () => {
    const { client, urls } = mock([]);
    expect(await client.batchGetValues("S", [])).toEqual({});
    expect(urls).toHaveLength(0);
  });

  it("detects shared drives by whether drives.get succeeds", async () => {
    const ok = createDriveClient(async () => ({ id: "x" }));
    const bad = createDriveClient(async () => {
      throw new Error("404");
    });
    expect(await ok.isSharedDrive("0Ax")).toBe(true);
    expect(await bad.isSharedDrive("0Ax")).toBe(false);
  });
});

describe("helpers", () => {
  it("quotes tab names", () => {
    expect(quoteTab("It's")).toBe("'It''s'");
  });
  it("extracts ids from links", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUv";
    expect(extractDriveId(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id);
    expect(extractDriveId(`https://drive.google.com/drive/u/1/folders/${id}`)).toBe(id);
    expect(extractDriveId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(extractDriveId(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(extractDriveId(id)).toBe(id);
    expect(extractDriveId("not a link")).toBeNull();
  });
});
