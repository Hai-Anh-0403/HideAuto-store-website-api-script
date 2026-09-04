import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { mongoModuleOptions } from './mongo/mongo.config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { LicensingModule } from './licensing/licensing.module';
import { AuthModule } from './auth/auth.module';
import { SellersModule } from './sellers/sellers.module';
import { ScriptsModule } from './scripts/scripts.module';
import { TagsModule } from './tags/tags.module';
import { KeysModule } from './keys/keys.module';
import { MembersModule } from './members/members.module';
import { BuildsModule } from './builds/builds.module';
import { StoreModule } from './store/store.module';
import { AdminModule } from './admin/admin.module';
import { AppClientModule } from './app-client/app-client.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), '.env'),
        join(process.cwd(), 'server', '.env'),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mongoModuleOptions(config.get<string>('MONGO_URI')),
    }),
    PrismaModule,
    StorageModule,
    LicensingModule,
    AuthModule,
    SellersModule,
    ScriptsModule,
    TagsModule,
    KeysModule,
    MembersModule,
    BuildsModule,
    StoreModule,
    AdminModule,
    AppClientModule,
    MediaModule,
  ],
})
export class AppModule {}
