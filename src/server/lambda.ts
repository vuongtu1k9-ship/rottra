import { handle } from "hono/aws-lambda";
import app from "../routes/api/[...paths]";

export const handler = handle(app);
