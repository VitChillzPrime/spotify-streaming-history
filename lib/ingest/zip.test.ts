import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { listZip, readZipEntry } from "@/lib/ingest/zip";

describe("native zip reader", () => {
  const big = JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ ts: `2024-01-01T00:00:${i % 60}Z`, n: i })));
  const zip = zipSync({
    "folder/deflated.json": [strToU8(big), { level: 6 }],
    "folder/stored.json": [strToU8('{"stored":true}'), { level: 0 }],
    "folder/": new Uint8Array(0),
  }) as Uint8Array<ArrayBuffer>;

  it("lists entries from the central directory", () => {
    const entries = listZip(zip);
    expect(entries?.map((e) => e.name).sort()).toEqual(["folder/", "folder/deflated.json", "folder/stored.json"]);
    const deflated = entries!.find((e) => e.name === "folder/deflated.json")!;
    expect(deflated.method).toBe(8);
    expect(deflated.size).toBe(big.length);
  });

  it("inflates deflated and stored entries", async () => {
    const entries = listZip(zip)!;
    const text = async (name: string) =>
      new TextDecoder().decode(await readZipEntry(zip, entries.find((e) => e.name === name)!));
    expect(await text("folder/deflated.json")).toBe(big);
    expect(await text("folder/stored.json")).toBe('{"stored":true}');
  });

  it("returns null for data that isn't a zip", () => {
    expect(listZip(strToU8("definitely not a zip file"))).toBeNull();
  });
});
