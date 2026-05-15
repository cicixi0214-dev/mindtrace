import { getRandomTopic } from "@/lib/deepseek";

export async function GET() {
  return Response.json({ topic: getRandomTopic() });
}
