import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const MARKETPLACE_SELLER_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type MarketplaceSellerStatus = (typeof MARKETPLACE_SELLER_STATUSES)[number];
export type MarketplaceSellerDocument = HydratedDocument<MarketplaceSeller>;

/**
 * Public seller read model for the storefront. Account credentials and operational data
 * remain in MySQL and must never be projected into this collection.
 */
@Schema({ collection: 'marketplace_sellers', timestamps: true })
export class MarketplaceSeller {
  /** The stable MySQL seller CUID already stored on MongoDB scripts. */
  @Prop({ required: true, trim: true, unique: true, index: true })
  sellerId!: string;

  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ type: String, default: null })
  avatarStorageKey?: string | null;

  @Prop({ type: String, default: null, trim: true })
  headline?: string | null;

  /** Editorial storefront marker. Only verified organizations receive this badge. */
  @Prop({ type: Boolean, default: false })
  verified!: boolean;

  @Prop({
    required: true,
    enum: MARKETPLACE_SELLER_STATUSES,
    default: 'PENDING',
    index: true,
  })
  status!: MarketplaceSellerStatus;
}

export const MarketplaceSellerSchema = SchemaFactory.createForClass(MarketplaceSeller);

MarketplaceSellerSchema.index({ status: 1, createdAt: -1 });
