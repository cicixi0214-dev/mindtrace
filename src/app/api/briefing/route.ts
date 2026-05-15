import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

async function getWeather(): Promise<{
  condition: string;
  temp: string;
  icon: string;
  city: string;
}> {
  try {
    const res = await fetch("https://wttr.in/?format=%C|%t|%c|%l&lang=zh&m", {
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    const parts = text.split("|");
    return {
      condition: parts[0]?.trim() || "",
      temp: parts[1]?.trim() || "",
      icon: parts[2]?.trim() || "☀️",
      city: parts[3]?.trim() || "",
    };
  } catch {
    return { condition: "", temp: "", icon: "☀️", city: "" };
  }
}

export async function GET() {
  const [recentEntries, people, weather] = await Promise.all([
    prisma.entry.findMany({ orderBy: { createdAt: "desc" }, take: 7 }),
    prisma.person.findMany(),
    getWeather(),
  ]);

  const allContent = recentEntries.map((e) => e.content).join("\n");
  const peopleSummary =
    people.length > 0
      ? people
          .map((p) => {
            const traits: string[] = JSON.parse(p.traits);
            return traits.length > 0 ? `${p.name}（${traits.join("、")}）` : p.name;
          })
          .join("、")
      : "";

  let greeting = "";
  let quote = "";

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是一个温暖的晨间助手「思迹」。根据用户近期记录、人物和天气，生成早间内容。

返回严格JSON格式（不要其他文字）：
{
  "greeting": "早安问候（50字内，自然提及天气和用户近期状态，最后问今天有什么安排）",
  "quote": "一句原创金句（20字内，契合用户近期心情/生活，不引用名人）"
}`,
          },
          {
            role: "user",
            content: `用户近期记录：${allContent || "暂无"}
已知人物：${peopleSummary || "暂无"}
今天天气：${weather.city ? `${weather.city}，` : ""}${weather.condition} ${weather.temp}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        greeting = parsed.greeting || "";
        quote = parsed.quote || "";
      }
    }
  } catch (e) {
    console.error("Briefing error:", e);
  }

  // Fallbacks
  if (!greeting) {
    const weatherNote = weather.condition
      ? `今天${weather.temp}，${weather.condition}`
      : "新的一天";
    greeting = `早上好～${weatherNote}。今天有什么安排？`;
  }

  return Response.json({
    greeting,
    quote,
    weather: {
      condition: weather.condition,
      temp: weather.temp,
      icon: weather.icon,
      city: weather.city,
    },
    hasPeople: people.length > 0,
    entryCount: recentEntries.length,
  });
}
