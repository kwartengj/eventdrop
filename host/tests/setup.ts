import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env") });
process.env.DATABASE_URL ||= "postgres://eventdrop:eventdrop@localhost:5432/eventdrop";
process.env.S3_ENDPOINT ||= "http://localhost:9000";
process.env.S3_PUBLIC_ENDPOINT ||= "http://localhost:9000";
process.env.S3_BUCKET ||= "eventdrop";
process.env.S3_ACCESS_KEY ||= "eventdrop";
process.env.S3_SECRET_KEY ||= "eventdrop-secret";
process.env.S3_REGION ||= "us-east-1";
process.env.PUBLIC_APP_URL ||= "http://localhost:3000";
