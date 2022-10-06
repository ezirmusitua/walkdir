import * as path from "path";
import { promises } from "fs";

export class FileEntry {
  constructor(
    readonly path: string,
    readonly parent: FileEntry = null as any,
    readonly children: FileEntry[] = []
  ) {}

  get fullpath(): string {
    if (this.parent) return path.join(this.parent.fullpath, this.path);
    return this.path;
  }

  async stat() {
    return promises.stat(this.fullpath);
  }

  append(child: string | FileEntry) {
    if (child instanceof FileEntry) {
      this.children.push(child);
    } else {
      this.children.push(new FileEntry(child, this));
    }
  }
}
// .
// ./d1
// ./d1/d1f2 ->
// ./d1/d1f1 ->
// ./d1 ->
// ./d2
// ./d2 ->
// ./f1 ->
// ./f2 ->
// ./d1/d1f2,./d1/d1f1,./d1,./d2,./f1,./f2
async function* _walk(dir: FileEntry): AsyncGenerator<FileEntry> {
  const files = await promises.opendir(dir.fullpath);
  for await (const d of files) {
    const entry = new FileEntry(d.name, dir);
    dir.append(entry);
    const stat = await entry.stat();
    if (stat.isDirectory()) {
      yield* _walk(entry);
    } else {
      yield entry;
    }
  }
  yield dir;
}

export async function walk(dir: string) {
  let list = [];
  const entry = new FileEntry(dir);
  for await (const f of _walk(entry)) {
    list.push(f);
  }
  return list;
}
