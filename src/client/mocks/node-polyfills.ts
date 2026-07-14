import { Secure } from "~/shared/utils/rng";
export const readFileSync = () => "";
export const writeFileSync = () => {};
export const existsSync = () => false;
export const resolve = () => "";
export const join = () => "";
export const dirname = () => "";
export const Database = class {};
export const performance = { now: () => Date.now() };
export const createHash = () => ({ update: () => ({ digest: () => "" }) });
export const cleanAndNormalize = (text: string) => text;
export const DatabaseError = class extends Error {};
export const search = () => ({});
export enum SafeSearchType {
  STRICT = "STRICT",
  MODERATE = "MODERATE",
  OFF = "OFF",
}
export const mkdirSync = () => {};
export const randomUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
export const env = {};
export const argv = [];
export const cwd = () => "/";
export const Buffer = class extends Uint8Array {
  static isBuffer(b: any): boolean {
    return b instanceof Uint8Array;
  }
  static from(data: any): InstanceType<any> {
    if (typeof data === "string") {
      return new Buffer(new TextEncoder().encode(data));
    }
    return new Buffer(data);
  }
  static alloc(size: number): InstanceType<any> {
    return new Buffer(size);
  }
  static allocUnsafe(size: number): InstanceType<any> {
    return new Buffer(size);
  }
  static byteLength(string: string) {
    return new TextEncoder().encode(string).length;
  }
  static concat(list: any[], totalLength?: number) {
    if (!Array.isArray(list)) throw new TypeError("list must be an Array");
    if (totalLength === undefined) {
      totalLength = list.reduce((acc, val) => acc + val.length, 0);
    }
    const result = new Buffer(totalLength!);
    let offset = 0;
    for (const buf of list) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  }
  toString() {
    return new TextDecoder().decode(this);
  }
  write(string: string, offset = 0) {
    const bytes = new TextEncoder().encode(string);
    const len = Math.min(bytes.length, this.length - offset);
    for (let i = 0; i < len; i++) {
      this[offset + i] = bytes[i];
    }
    return len;
  }
  writeUInt32BE(value: number, offset = 0) {
    this[offset] = (value >>> 24) & 0xff;
    this[offset + 1] = (value >>> 16) & 0xff;
    this[offset + 2] = (value >>> 8) & 0xff;
    this[offset + 3] = value & 0xff;
    return offset + 4;
  }
  readUInt32BE(offset = 0) {
    return (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3];
  }
};
export class AsyncLocalStorage {
  disable() {}
  getStore() {
    return undefined;
  }
  run(store: any, callback: any, ...args: any[]) {
    return callback(...args);
  }
  enterWith(store: any) {}
}
export default {
  readFileSync,
  writeFileSync,
  existsSync,
  resolve,
  join,
  dirname,
  Database,
  performance,
  createHash,
  cleanAndNormalize,
  DatabaseError,
  search,
  SafeSearchType,
  mkdirSync,
  randomUUID,
  env,
  argv,
  cwd,
  Buffer,
  AsyncLocalStorage,
};
