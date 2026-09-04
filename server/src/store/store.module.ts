import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreController } from './store.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreService } from './store.service';
import { Script, ScriptSchema } from '../scripts/schemas/script.schema';
import { ScriptVersion, ScriptVersionSchema } from '../scripts/schemas/script-version.schema';
import { Tag, TagSchema } from '../tags/schemas/tag.schema';

@Module({
  imports: [
    PrismaModule,
    MongooseModule.forFeature([
      { name: Script.name, schema: ScriptSchema },
      { name: ScriptVersion.name, schema: ScriptVersionSchema },
      { name: Tag.name, schema: TagSchema },
    ]),
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
