import * as path from "path";
import { Stats, promises } from "fs";
import * as checksum from "checksum";

function file_checksum(
  fp: string,
  alg: "md5" | "sha1" = "sha1"
): Promise<string> {
  return new Promise((resolve, reject) => {
    checksum.file(fp, { algorithm: alg }, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });
}

export class FileEntry {
  private _stats: Stats = null as any;
  private _checksum = "";
  constructor(
    readonly path: string,
    readonly parent: FileEntry = null as any,
    readonly children: FileEntry[] = []
  ) {}

  get fullpath(): string {
    if (this.parent) return path.join(this.parent.fullpath, this.path);
    return this.path;
  }

  async read() {
    return promises.readFile(this.fullpath);
  }

  async read_string(encoding: BufferEncoding = "utf8") {
    const buffer = await promises.readFile(this.fullpath);
    return buffer.toString(encoding);
  }

  async read_json() {
    const str = await this.read_string();
    return JSON.parse(str);
  }

  async stats() {
    if (this._stats) return this._stats;
    return promises.stat(this.fullpath);
  }

  async checksum() {
    const stats = await this.stats();
    if (!this._checksum && stats.isDirectory()) {
      const children_checksum = [];
      for await (const child of this.children) {
        const checksum = await child.checksum();
        children_checksum.push(checksum);
      }
      this._checksum = checksum(children_checksum.join("|"));
    }
    if (!this._checksum && stats.isFile()) {
      this._checksum = await file_checksum(this.fullpath);
    }
    return this._checksum;
  }

  append(child: string | FileEntry) {
    if (child instanceof FileEntry) {
      this.children.push(child);
    } else {
      this.children.push(new FileEntry(child, this));
    }
  }
}

async function* _walk(dir: FileEntry): AsyncGenerator<FileEntry> {
  const files = await promises.opendir(dir.fullpath);
  for await (const d of files) {
    const entry = new FileEntry(d.name, dir);
    dir.append(entry);
    const stats = await entry.stats();
    if (stats.isDirectory()) {
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
