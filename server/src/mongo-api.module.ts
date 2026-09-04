import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { mongoModuleOptions } from './mongo/mongo.config';
import { MongoStoreModule } from './store/mongo-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), join(process.cwd(), '.env'), join(process.cwd(), 'server', '.env')],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => mongoModuleOptions(config.get<string>('MONGO_URI')),
    }),
    MongoStoreModule,
  ],
})
export class MongoApiModule {}
