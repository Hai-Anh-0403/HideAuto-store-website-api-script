import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import slugify from 'slugify';
import { Model, Types } from 'mongoose';
import { ConflictError, NotFoundError } from '../common/errors';
import { CreateScriptDto } from '../scripts/dto/create-script.dto';
import { Script } from '../scripts/schemas/script.schema';
import { ScriptVersion } from '../scripts/schemas/script-version.schema';
import { StorageService } from '../storage/storage.service';
import { scrubCredentials } from '../common/graph/workflow-graph';

/** Seller write path for the experimental MongoDB API only. */
@Injectable()
export class MongoScriptsService {
  constructor(
    @InjectModel(Script.name) private readonly scripts: Model<Script>,
    @InjectModel(ScriptVersion.name) private readonly versions: Model<ScriptVersion>,
    private readonly storage: StorageService,
  ) {}

  async create(sellerId: string, dto: CreateScriptDto) {
    const slug = await this.uniqueSlug(dto.name);
    const tagIds = this.parseTagIds(dto.tagIds);
    const script = await this.scripts.create({
      sellerId,
      slug,
      name: dto.name,
      shortDescription: dto.shortDescription ?? '',
      descriptionHtml: dto.description ?? null,
      tagIds,
      status: 'DRAFT',
    });
    const version = await this.versions.create({
      scriptId: script._id,
      sellerId,
      version: dto.version ?? '1.0.0',
      status: 'PENDING_REVIEW',
      scrubbedGraphStorageKey: 'pending-upload',
      changelog: dto.changelog ?? null,
    });
    return { id: script._id.toString(), slug, versionId: version._id.toString(), status: 'DRAFT' as const };

  }

  async uploadGraph(sellerId: string, scriptId: string, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new ConflictError('file_required', 'A graph JSON file is required');
    if (!Types.ObjectId.isValid(scriptId)) throw new NotFoundError('script_not_found', 'Script not found');
    const script = await this.scripts.findOne({ _id: new Types.ObjectId(scriptId), sellerId });
    if (!script) throw new NotFoundError('script_not_found', 'Script not found');
    let graph: unknown;
    try { graph = JSON.parse(file.buffer.toString('utf8')); } catch { throw new ConflictError('graph_invalid', 'File must contain valid graph JSON'); }
    const { graph: scrubbed, scan } = scrubCredentials(
      graph as Parameters<typeof scrubCredentials>[0],
    );
    const stored = await this.storage.saveBytes(Buffer.from(JSON.stringify(scrubbed)), 'graphs', `${script.slug}.json`);
    const version = await this.versions.findOneAndUpdate(
      { scriptId: script._id, sellerId, status: 'PENDING_REVIEW' },
      { scrubbedGraphStorageKey: stored.ref, embeddedCredentialsCount: scan.embedded_credentials_count },
      { new: true, sort: { createdAt: -1 } },
    );
    if (!version) throw new ConflictError('no_pending_version', 'No pending version to upload');
    return { versionId: version._id.toString(), credentialCount: scan.embedded_credentials_count };
  }

  async submit(sellerId: string, scriptId: string) {
    if (!Types.ObjectId.isValid(scriptId)) {
      throw new NotFoundError('script_not_found', 'Script not found');
    }
    const script = await this.scripts.findOne({
      _id: new Types.ObjectId(scriptId), sellerId,
    });
    if (!script) throw new NotFoundError('script_not_found', 'Script not found');
    if (script.status !== 'DRAFT' && script.status !== 'REJECTED') {
      throw new ConflictError('not_submittable', 'Only DRAFT or REJECTED scripts can be submitted');
    }
    const pending = await this.versions.exists({ scriptId: script._id, status: 'PENDING_REVIEW' });
    if (!pending) throw new ConflictError('no_pending_version', 'No pending version to review');
    script.status = 'PENDING_REVIEW';
    await script.save();
    return { id: script._id.toString(), status: script.status };
  }

  private parseTagIds(raw?: string): Types.ObjectId[] {
    if (!raw?.trim()) return [];
    const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
    if (values.some((value) => !Types.ObjectId.isValid(value))) {
      throw new ConflictError('invalid_tag_ids', 'tagIds must contain MongoDB ObjectIds');
    }
    return values.map((value) => new Types.ObjectId(value));
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true }) || 'script';
    let slug = base;
    let number = 1;
    while (await this.scripts.exists({ slug })) slug = `${base}-${number++}`;
    return slug;
  }
}
