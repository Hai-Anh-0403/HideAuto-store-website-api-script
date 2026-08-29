/**
 * Content-addressed artifact storage on local disk.
 *
 * Files are stored under `STORAGE_DIR` keyed by their sha256, so re-uploading the same
 * package costs nothing and every stored ref is verifiable. Swapping in S3 later means
 * reimplementing `saveBytes` / `readBytes`; nothing outside this service knows the layout.
 */

import { Injectable, BadRequestException, GoneException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const SUFFIX_RE = /^\.[A-Za-z0-9]{1,10}$/;

export interface StoredFile {
  ref: string;
  checksum: string;
  sizeBytes: number;
}

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('STORAGE_DIR', 'var/storage'));
  }

  private safeSuffix(filename: string): string {
    const suffix = path.extname(filename);
    return SUFFIX_RE.test(suffix) ? suffix.toLowerCase() : '';
  }

  /** Resolve a stored ref, refusing anything that escapes the storage root. */
  private resolve(ref: string): string {
    const target = path.resolve(this.root, ref);
    const rel = path.relative(this.root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new BadRequestException('Invalid storage reference');
    }
    return target;
  }

  async saveBytes(
    data: Buffer,
    subdir: string,
    filename: string,
  ): Promise<StoredFile> {
    const checksum = createHash('sha256').update(data).digest('hex');
    const ref = `${subdir}/${checksum.slice(0, 2)}/${checksum}${this.safeSuffix(filename)}`;
    const target = this.resolve(ref);

    await fs.mkdir(path.dirname(target), { recursive: true });
    // Content-addressed: same checksum ⇒ same bytes, so an existing file is already correct.
    try {
      await fs.access(target);
    } catch {
      const tmp = `${target}.tmp`;
      await fs.writeFile(tmp, data);
      await fs.rename(tmp, target);
    }

    return { ref, checksum, sizeBytes: data.length };
  }

  /**
   * Write bytes at an explicit key (overwrite). Used for unwrapped mini-app exe/icon
   * so re-upload of the same appId+version replaces the same object, matching S3.
   */
  async saveAs(key: string, data: Buffer): Promise<StoredFile> {
    const checksum = createHash('sha256').update(data).digest('hex');
    const target = this.resolve(key.replace(/\\/g, '/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
    return { ref: key.replace(/\\/g, '/'), checksum, sizeBytes: data.length };
  }

  /** Absolute path of a stored artifact — for streaming it back to the client. */
  pathFor(ref: string): string {
    return this.resolve(ref);
  }

  async readBytes(ref: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(ref));
    } catch {
      throw new GoneException('Stored file is missing');
    }
  }
}
