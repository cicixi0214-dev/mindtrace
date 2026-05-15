import { getFollowupQuestion } from "@/lib/deepseek";
import type { Personality } from "@/lib/deepseek";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { content, existingFollowups, maxRounds, personality } = await req.json();

  if (!content?.trim()) {
    return Response.json({ error: "内容不能为空" }, { status: 400 });
  }

  try {
    // Fetch known people to give AI context
    const people = await prisma.person.findMany({ orderBy: { updatedAt: "desc" } });
    let peopleContext: string | undefined;
    if (people.length > 0) {
      peopleContext = people
        .map((p) => {
          const traits: string[] = JSON.parse(p.traits);
          const events: string[] = JSON.parse(p.events);
          const parts = [`${p.name}（${p.summary || "用户提到过的人"}`];
          if (traits.length > 0) parts.push(`特征：${traits.join("、")}`);
          if (events.length > 0) parts.push(`相关事件：${events.join("；")}`);
          return parts.join("。") + "）";
        })
        .join("\n");
    }

    const question = await getFollowupQuestion(
      content,
      existingFollowups ?? [],
      maxRounds ?? 3,
      (personality ?? "friend") as Personality,
      peopleContext
    );
    return Response.json({ question });
  } catch {
    return Response.json({ error: "获取追问失败" }, { status: 500 });
  }
}
