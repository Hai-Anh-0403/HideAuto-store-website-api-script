import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SCRIPT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];
export type ScriptDocument = HydratedDocument<Script>;

@Schema({ collection: 'scripts', timestamps: true })
export class Script {
  @Prop({ required: true, trim: true, index: true })
  sellerId!: string;

  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '', trim: true })
  shortDescription!: string;

  @Prop({ type: String, default: null })
  descriptionHtml?: string | null;

  @Prop({ required: true, enum: SCRIPT_STATUSES, default: 'DRAFT' })
  status!: ScriptStatus;

  @Prop({ type: [Types.ObjectId], default: [] })
  tagIds!: Types.ObjectId[];

  @Prop({ type: String, default: null })
  thumbnailStorageKey?: string | null;

  @Prop({ type: [String], default: [] })
  galleryStorageKeys!: string[];

  @Prop({ type: Types.ObjectId, default: null })
  latestApprovedVersionId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null;

  @Prop({ type: Date, default: null })
  archivedAt?: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  ratingAvg!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  ratingCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  downloads!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  views!: number;

  @Prop({ type: String, default: '$29', trim: true })
  price!: string;

  @Prop({ type: Number, default: 29, min: 0 })
  priceAmount!: number;

  @Prop({ type: String, default: 'USD', trim: true })
  currency!: string;
}

export const ScriptSchema = SchemaFactory.createForClass(Script);

ScriptSchema.index({ slug: 1 }, { unique: true });
ScriptSchema.index({ status: 1, publishedAt: -1 });
ScriptSchema.index({ sellerId: 1, updatedAt: -1 });
ScriptSchema.index({ tagIds: 1, status: 1, publishedAt: -1 });
ScriptSchema.index({ status: 1, priceAmount: 1, publishedAt: -1 });
