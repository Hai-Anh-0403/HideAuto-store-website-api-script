import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TagDocument = HydratedDocument<Tag>;

@Schema({ collection: 'tags', timestamps: true })
export class Tag {
  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;
}

export const TagSchema = SchemaFactory.createForClass(Tag);

TagSchema.index({ slug: 1 }, { unique: true });
