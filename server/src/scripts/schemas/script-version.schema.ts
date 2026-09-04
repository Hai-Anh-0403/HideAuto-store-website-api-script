import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SCRIPT_VERSION_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETIRED',
] as const;

export type ScriptVersionStatus = (typeof SCRIPT_VERSION_STATUSES)[number];
export type ScriptVersionDocument = HydratedDocument<ScriptVersion>;

@Schema({ _id: false })
class Review {
  @Prop({ type: String, default: null })
  reviewedByAdminId?: string | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: String, default: null })
  rejectionReason?: string | null;
}

const ReviewSchema = SchemaFactory.createForClass(Review);

@Schema({ collection: 'script_versions', timestamps: true })
export class ScriptVersion {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  scriptId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  sellerId!: string;

  @Prop({ required: true, trim: true })
  version!: string;

  @Prop({ required: true, enum: SCRIPT_VERSION_STATUSES, default: 'DRAFT' })
  status!: ScriptVersionStatus;

  @Prop({ type: String, required: true, trim: true })
  scrubbedGraphStorageKey!: string;

  @Prop({ type: String, default: null })
  changelog?: string | null;

  @Prop({ type: Date, default: null })
  releasedAt?: Date | null;

  @Prop({ type: [String], default: [] })
  capabilities!: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  embeddedCredentialsCount!: number;

  @Prop({ type: ReviewSchema, default: () => ({}) })
  review!: Review;
}

export const ScriptVersionSchema = SchemaFactory.createForClass(ScriptVersion);

ScriptVersionSchema.index({ scriptId: 1, version: 1 }, { unique: true });
ScriptVersionSchema.index({ scriptId: 1, status: 1, createdAt: -1 });
ScriptVersionSchema.index({ sellerId: 1, createdAt: -1 });
