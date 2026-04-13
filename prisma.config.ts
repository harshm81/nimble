import { config } from 'dotenv';
import path from 'path';
import { defineConfig } from 'prisma/config';

config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
