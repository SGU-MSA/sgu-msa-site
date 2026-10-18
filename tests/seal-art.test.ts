import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Review fixes PR-C: the seal is one cached sprite generated from the one
// seal file, coloured by the theme through each shape's style. The generated
// files must match the seal file.
const script = new URL("../scripts/seal-art.mjs", import.meta.url);
type SealArt = {
  sealSprite: (svg: string) => string;
  sealArtSource: (svg: string) => Promise<string>;
  sealFile: URL;
  spriteFile: URL;
  artFile: URL;
  symbolId: string;
};
// A computed specifier keeps the untyped .mjs out of the TypeScript program.
const load = async (): Promise<SealArt> => import(script.href);

test("the sprite and seal-art.ts are generated from seal.svg (run `node scripts/seal-art.mjs`)", async () => {
  const { sealSprite, sealArtSource, sealFile, spriteFile, artFile } =
    await load();
  const svg = readFileSync(sealFile, "utf8");
  assert.equal(readFileSync(spriteFile, "utf8"), sealSprite(svg));
  assert.equal(readFileSync(artFile, "utf8"), await sealArtSource(svg));
});

test("every seal shape takes a theme colour in its own style, never a fixed fill", async () => {
  const { spriteFile } = await load();
  const sprite = readFileSync(spriteFile, "utf8");
  const fills = sprite.match(/style="[^"]*"/g) ?? [];
  assert.ok(fills.length > 50);
  for (const fill of fills)
    assert.match(
      fill,
      /^style="fill:var\(--seal-(ink|mint|cream),#[0-9A-Fa-f]{6}\)"$/,
    );
  assert.doesNotMatch(sprite, /class=|fill="#|<style|<script/);
});

test("the seal is drawn from the sprite, in a box from 0 0, never shifted twice", async () => {
  const { symbolId, spriteFile } = await load();
  const { SEAL_SPRITE, SEAL_VIEWBOX } =
    await import("../src/shared/ui/seal-art");
  assert.match(
    SEAL_SPRITE,
    new RegExp(
      `^/images/brand/seal-sprite\\.svg\\?v=[0-9a-f]{10}#${symbolId}$`,
    ),
  );
  const symbolBox = new RegExp(
    `<symbol id="${symbolId}" viewBox="[\\d.]+ [\\d.]+ ([\\d.]+) ([\\d.]+)"`,
  ).exec(readFileSync(spriteFile, "utf8"));
  assert.ok(symbolBox);
  assert.equal(SEAL_VIEWBOX, `0 0 ${symbolBox[1]} ${symbolBox[2]}`);
});

test("no page carries the seal's drawing inline", () => {
  for (const file of ["../src/app/layout.tsx", "../src/shared/ui/Seal.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /SealSymbol|SEAL_ART|<symbol/);
  }
});

// Site essentials: the app icons are committed files generated from the seal
// and the Green Ink tokens; they must not go stale.
const pngSize = (file: URL) => {
  const data = readFileSync(file);
  assert.equal(data.subarray(1, 4).toString(), "PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

test("the icons exist at their sizes and were generated from the current seal and colours", async () => {
  const { iconFiles, sealFile, tokensFile, iconsHash, lightColours } =
    (await import(script.href)) as {
      iconFiles: Record<string, URL>;
      sealFile: URL;
      tokensFile: URL;
      iconsHash: (svg: string, colours: unknown) => string;
      lightColours: (css: string) => unknown;
    };
  const { SEAL_ICONS_HASH } = await import("../src/shared/ui/seal-art");
  assert.equal(
    SEAL_ICONS_HASH,
    iconsHash(
      readFileSync(sealFile, "utf8"),
      lightColours(readFileSync(tokensFile, "utf8")),
    ),
  );
  assert.deepEqual(pngSize(iconFiles.apple), [180, 180]);
  assert.deepEqual(pngSize(iconFiles.icon192), [192, 192]);
  assert.deepEqual(pngSize(iconFiles.icon512), [512, 512]);
  assert.deepEqual(pngSize(iconFiles.maskable), [512, 512]);
  const ico = readFileSync(iconFiles.favicon);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.deepEqual(
    Array.from({ length: count }, (_, i) => ico.readUInt8(6 + 16 * i)),
    [16, 32, 48],
  );
});
