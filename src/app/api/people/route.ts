import { prisma } from "@/lib/prisma";

export async function GET() {
  const people = await prisma.person.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(
    people.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      traits: JSON.parse(p.traits),
      events: JSON.parse(p.events),
      updatedAt: p.updatedAt,
    }))
  );
}
