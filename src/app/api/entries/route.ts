import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const entries = await prisma.entry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json(entries);
}

export async function POST(req: NextRequest) {
  const { content, followups } = await req.json();

  if (!content?.trim()) {
    return Response.json({ error: "内容不能为空" }, { status: 400 });
  }

  const entry = await prisma.entry.create({
    data: {
      content: content.trim(),
      followups: JSON.stringify(followups ?? []),
    },
  });

  return Response.json(entry, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, followups } = await req.json();

  if (!id || !followups) {
    return Response.json({ error: "缺少参数" }, { status: 400 });
  }

  const entry = await prisma.entry.update({
    where: { id },
    data: { followups: JSON.stringify(followups) },
  });

  return Response.json(entry);
}
