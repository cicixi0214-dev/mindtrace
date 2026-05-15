import { prisma } from "@/lib/prisma";

const CATEGORY_LABELS: Record<string, string> = {
  value: "价值观",
  belief: "信念",
  trait: "性格特质",
  life_lesson: "人生感悟",
  goal: "目标与愿望",
};

export async function GET() {
  const insights = await prisma.userInsight.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Group by category
  const grouped: Record<string, string[]> = {};
  for (const ins of insights) {
    const label = CATEGORY_LABELS[ins.category] ?? ins.category;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(ins.content);
  }

  // Return as sorted array
  const categoryOrder = ["价值观", "信念", "性格特质", "人生感悟", "目标与愿望"];
  const result = categoryOrder
    .filter((cat) => grouped[cat])
    .map((cat) => ({ category: cat, items: grouped[cat] }));

  return Response.json(result);
}
