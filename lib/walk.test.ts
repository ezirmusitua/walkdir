import * as path from "path";
import * as fs from "fs";
import { FileEntry, walk } from "./walk";

async function _start_mock(entry: string) {
  await fs.promises.mkdir(entry);
  await Promise.all(
    ["d1", "d2"].map((d) => fs.promises.mkdir(path.join(entry, d)))
  );
  await Promise.all(
    ["f1", "f2"].map((f) => fs.promises.writeFile(path.join(entry, f), f))
  );
  await Promise.all(
    ["d1f1", "d1f2"].map((df) =>
      fs.promises.writeFile(path.join(entry, "d1", df), df)
    )
  );
  return async () => {
    await Promise.all(
      ["d1f1", "d1f2"].map((df) => fs.promises.rm(path.join(entry, "d1", df)))
    );
    await Promise.all(
      ["f1", "f2"].map((f) => fs.promises.rm(path.join(entry, f)))
    );
    await Promise.all(
      ["d1", "d2"].map((d) => fs.promises.rmdir(path.join(entry, d)))
    );
    await fs.promises.rmdir(entry);
  };
}

function convert_result1(list: FileEntry[]) {
  return list
    .map((item) => `${item.parent?.path || ""}:${item.path}`)
    .join(",");
}

function convert_result2(list: FileEntry[]) {
  return list.map((item) => item.fullpath).join(",");
}

test("walk should work", async () => {
  const entry = "__mockdir";
  const result1 = [
    `d1:d1f2`,
    `d1:d1f1`,
    `${entry}:d1`,
    `${entry}:f2`,
    `${entry}:d2`,
    `${entry}:f1`,
    `:${entry}`,
  ].join(",");
  const result2 = [
    `${entry}/d1/d1f2`,
    `${entry}/d1/d1f1`,
    `${entry}/d1`,
    `${entry}/f2`,
    `${entry}/d2`,
    `${entry}/f1`,
    `${entry}`,
  ].join(",");
  const _clean_mock = await _start_mock(entry);
  const list = await walk(entry);
  await _clean_mock();
  expect(convert_result1(list)).toBe(result1);
  expect(convert_result2(list)).toBe(result2);
});

test("should read correctly", async () => {
  const _mock_content = () => {
    fs.mkdirSync("__mock");
    const fp = path.join("__mock", "file.json");
    fs.writeFileSync(fp, JSON.stringify({ mock: true }));
    return () => {
      fs.rmSync(fp);
      fs.rmdirSync("__mock");
    };
  };
  const _clean = _mock_content();
  const [target] = await walk("__mock");
  const buf = await target.read();
  const str = await target.read_string();
  const json = await target.read_json();
  expect(JSON.parse(buf.toString())).toStrictEqual({ mock: true });
  expect(JSON.parse(str)).toStrictEqual({ mock: true });
  expect(json).toStrictEqual({ mock: true });
  _clean();
});
