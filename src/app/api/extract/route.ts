import { extractPeopleAndInsights } from "@/lib/deepseek";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { content, followups } = await req.json();

  if (!content?.trim()) {
    return Response.json({ error: "内容不能为空" }, { status: 400 });
  }

  try {
    const result = await extractPeopleAndInsights(content, followups ?? []);

    // Upsert people
    for (const p of result.people) {
      const existing = await prisma.person.findUnique({ where: { name: p.name } });
      if (existing) {
        const existingTraits: string[] = JSON.parse(existing.traits);
        const existingEvents: string[] = JSON.parse(existing.events);
        const mergedTraits = [...new Set([...existingTraits, ...p.traits])];
        const mergedEvents = [...existingEvents, p.event].filter(Boolean);
        await prisma.person.update({
          where: { id: existing.id },
          data: {
            traits: JSON.stringify(mergedTraits),
            events: JSON.stringify(mergedEvents),
            summary: `${p.relationship ? `关系：${p.relationship}。` : ""}${mergedEvents.length > 0 ? `共提到${mergedEvents.length}次` : ""}`,
          },
        });
      } else {
        await prisma.person.create({
          data: {
            name: p.name,
            summary: p.relationship ? `关系：${p.relationship}` : "",
            traits: JSON.stringify(p.traits ?? []),
            events: JSON.stringify(p.event ? [p.event] : []),
          },
        });
      }
    }

    // Save user insights
    for (const insight of result.userInsights) {
      await prisma.userInsight.create({
        data: {
          category: insight.category,
          content: insight.content,
        },
      });
    }

    return Response.json({ extracted: true, people: result.people, insights: result.userInsights });
  } catch (e) {
    console.error("Extraction endpoint error:", e);
    return Response.json({ error: "提取失败" }, { status: 500 });
  }
}
