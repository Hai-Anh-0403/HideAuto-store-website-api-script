import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConflictError, NotFoundError } from '../common/errors';
import { Script } from '../scripts/schemas/script.schema';
import { ScriptVersion } from '../scripts/schemas/script-version.schema';

@Injectable()
export class MongoAdminService {
  constructor(@InjectModel(Script.name) private readonly scripts: Model<Script>, @InjectModel(ScriptVersion.name) private readonly versions: Model<ScriptVersion>) {}
  async approve(versionId: string, adminId: string) {
    if (!Types.ObjectId.isValid(versionId)) throw new NotFoundError('version_not_found', 'Script version not found');
    const version = await this.versions.findById(versionId);
    if (!version) throw new NotFoundError('version_not_found', 'Script version not found');
    if (version.status !== 'PENDING_REVIEW') throw new ConflictError('version_decided', 'Version has already been decided');
    if (!version.scrubbedGraphStorageKey) throw new ConflictError('version_has_no_file', 'Upload a scrubbed graph first');
    if (version.embeddedCredentialsCount > 0) throw new ConflictError('credentials_present', 'Version contains embedded credentials');
    const now = new Date();
    version.status = 'APPROVED'; version.releasedAt = now; version.review.reviewedByAdminId = adminId; version.review.reviewedAt = now;
    await version.save();
    await this.scripts.updateOne({ _id: version.scriptId, status: { $ne: 'ARCHIVED' } }, { $set: { status: 'PUBLISHED', publishedAt: now, latestApprovedVersionId: version._id } });
    return { id: version._id.toString(), status: version.status };
  }
  async reject(versionId: string, adminId: string, reason: string) {
    if (!Types.ObjectId.isValid(versionId)) throw new NotFoundError('version_not_found', 'Script version not found');
    const version = await this.versions.findById(versionId);
    if (!version) throw new NotFoundError('version_not_found', 'Script version not found');
    if (version.status !== 'PENDING_REVIEW') throw new ConflictError('version_decided', 'Version has already been decided');
    version.status = 'REJECTED'; version.review.reviewedByAdminId = adminId; version.review.reviewedAt = new Date(); version.review.rejectionReason = reason;
    await version.save();
    const approved = await this.versions.exists({ scriptId: version.scriptId, status: 'APPROVED' });
    if (!approved) await this.scripts.updateOne({ _id: version.scriptId }, { $set: { status: 'REJECTED', rejectReason: reason } });
    return { id: version._id.toString(), status: version.status };
  }
}
