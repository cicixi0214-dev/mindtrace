import { stats } from "@/lib/tokens";

export async function GET() {
  return Response.json(stats());
}
