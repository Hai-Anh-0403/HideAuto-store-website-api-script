import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { Script, ScriptSchema } from '../scripts/schemas/script.schema';
import { ScriptVersion, ScriptVersionSchema } from '../scripts/schemas/script-version.schema';
import { Tag, TagSchema } from '../tags/schemas/tag.schema';
import { MongoStoreController } from './mongo-store.controller';
import { MongoScriptsController } from './mongo-scripts.controller';
import { MongoScriptsService } from './mongo-scripts.service';
import { MongoAdminController } from './mongo-admin.controller';
import { MongoAdminService } from './mongo-admin.service';
import { StoreService } from './store.service';

@Module({
  imports: [
    PrismaModule, AuthModule, StorageModule,
    MongooseModule.forFeature([
      { name: Script.name, schema: ScriptSchema },
      { name: ScriptVersion.name, schema: ScriptVersionSchema },
      { name: Tag.name, schema: TagSchema },
    ]),
  ],
  controllers: [MongoStoreController, MongoScriptsController, MongoAdminController],
  providers: [StoreService, MongoScriptsService, MongoAdminService],
})
export class MongoStoreModule {}
