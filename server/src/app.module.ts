import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { SellersModule } from './sellers/sellers.module';
import { ScriptsModule } from './scripts/scripts.module';
import { TagsModule } from './tags/tags.module';
import { KeysModule } from './keys/keys.module';
import { MembersModule } from './members/members.module';
import { BuildsModule } from './builds/builds.module';
import { StoreModule } from './store/store.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    SellersModule,
    ScriptsModule,
    TagsModule,
    KeysModule,
    MembersModule,
    BuildsModule,
    StoreModule,
    AdminModule,
  ],
})
export class AppModule {}
