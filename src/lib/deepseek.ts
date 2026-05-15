const BASE_URL =
  process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

type FollowupRound = { question: string; answer: string };

export type Personality = "friend" | "wise" | "family";

const PERSONALITY_LABELS: Record<Personality, string> = {
  friend: "知心朋友",
  wise: "智者",
  family: "家人",
};

const PERSONALITY_PROMPTS: Record<Personality, string> = {
  friend: `你是「思迹」小助手，性格是「知心朋友」。
你温暖、真诚、有同理心，像最好的朋友一样倾听。
你会在追问前先给对方情感反馈，让人感受到被理解。

## 你的风格
- 先用简短温暖的话回应对方的内容（比如"听起来不容易""能感受到你的开心""抱抱你"）
- 再自然地提出一个追问，帮助对方想得更深
- 语气口语化，像朋友聊天，不说大道理
- 适当使用语气词：呀、呢、啊、吧

## 五维框架（你心里默默用，不告诉用户）
① 事实 ② 情绪 ③ 观点 ④ 决策 ⑤ 知识
追问优先级：观点 > 情绪 > 知识 > 决策 > 事实
所有维度都覆盖了就返回"null"`,

  wise: `你是「思迹」小助手，性格是「智者」。
你沉静、深邃、有智慧，像一位历经沧桑的长者。
你说的话不多但有力，帮对方看到更深层的意义。

## 你的风格
- 话语简洁，有时略带诗意
- 先安静地肯定对方的分享（如"这让我想起一段话""你的感受很珍贵"）
- 再抛出一个有分量的问题，让对方深思
- 语气平和中正，不急不缓
- 可以引用一句短谚语或格言，但不要长篇大论

## 五维框架（你心里默默用，不告诉用户）
① 事实 ② 情绪 ③ 观点 ④ 决策 ⑤ 知识
追问优先级：观点 > 知识 > 情绪 > 决策 > 事实
所有维度都覆盖了就返回"null"`,

  family: `你是「思迹」小助手，性格是「家人」。
你像一位慈祥的长辈/亲近的家人，温暖、包容、充满关爱。
你用最朴实的话表达关心，让对方感到安心和被爱。

## 你的风格
- 先关心对方的身体和心情（如"吃饭了没""最近身体还好吧"）
- 再温柔地追问，像家里人在饭桌上聊天
- 语气亲切家常，可以适当用"咱""咱们"
- 不说复杂的话，简简单单但暖到心里
- 偶尔分享一点自己的生活智慧

## 五维框架（你心里默默用，不告诉用户）
① 事实 ② 情绪 ③ 观点 ④ 决策 ⑤ 知识
追问优先级：情绪 > 观点 > 知识 > 事实 > 决策
所有维度都覆盖了就返回"null"`,
};

export function getPersonalityLabel(p: Personality): string {
  return PERSONALITY_LABELS[p];
}

/**
 * Returns a follow-up question (with emotional warmth), or null if all covered.
 */
export async function getFollowupQuestion(
  content: string,
  existingFollowups: FollowupRound[] = [],
  maxRounds = 5,
  personality: Personality = "friend",
  peopleContext?: string
): Promise<AiResult<string | null>> {
  if (existingFollowups.length >= maxRounds) return { data: null, usage: null };

  let conversation = `用户原始记录：${content}\n`;
  if (existingFollowups.length > 0) {
    conversation += "\n已有的对话：\n";
    existingFollowups.forEach((r, i) => {
      conversation += `你：${r.question}\n用户：${r.answer}\n`;
    });
  }

  const systemContent = peopleContext
    ? `${PERSONALITY_PROMPTS[personality]}\n\n## 你了解的用户背景\n${peopleContext}`
    : PERSONALITY_PROMPTS[personality];

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
          content: systemContent,
        },
        {
          role: "user",
          content: `${conversation}\n\n请根据你的性格，先给情感反馈，再提出一个自然的追问。如果所有维度都已覆盖，只返回"null"。`,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    console.error("DeepSeek API error:", await res.text());
    return { data: getFallbackQuestion(content, existingFollowups, personality), usage: null };
  }

  const data = await res.json();
  const usage = data.usage
    ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens, total: data.usage.total_tokens }
    : null;
  const result = data.choices?.[0]?.message?.content?.trim();

  if (!result || result.toLowerCase() === "null") return { data: null, usage };

  return { data: result, usage };
}

export function getFallbackQuestion(
  content: string,
  existingFollowups: FollowupRound[] = [],
  personality: Personality = "friend"
): string | null {
  if (existingFollowups.length >= 5) return null;

  const allText = [
    content,
    ...existingFollowups.flatMap((r) => [r.question, r.answer]),
  ].join(" ");

  const hasEmotion =
    /开心|难过|高兴|伤心|愤怒|生气|害怕|焦虑|感动|失望|满足|后悔|幸福|痛苦|喜欢|讨厌/i.test(
      allText
    );
  const hasOpinion =
    /觉得|认为|以为|看法|观点|信念|重要|对|错|好|坏/i.test(allText);
  const hasLesson =
    /学到|明白|懂得|教训|经验|体会|改变|成长|以后|将来/i.test(allText);
  const hasDecision =
    /打算|计划|决定|准备|将要|行动|开始|调整|以后会/i.test(allText);
  const hasWisdom =
    /理解|意识到|认识到|体会到|发现|原来|人生|生活|世界/i.test(allText);

  // Warm opening based on personality
  const warmOpenings: Record<Personality, string[]> = {
    friend: ["嗯，我听到了。", "明白了，谢谢你和我说这些。", "能感受到你的心情。"],
    wise: ["你的分享很珍贵。", "每段经历都是一面镜子。", "嗯，我在听。"],
    family: ["诶，我在听呢。", "咱慢慢说，不着急。", "身体还好吧，边说我边听着。"],
  };

  const opening =
    warmOpenings[personality][
      Math.floor(Math.random() * warmOpenings[personality].length)
    ];

  if (!hasEmotion) {
    const qs: Record<Personality, string[]> = {
      friend: [
        "当时心里是什么滋味呀？",
        "那会儿你心情怎么样？",
        "这件事让你有什么感觉？",
      ],
      wise: [
        "那时的你，心里是什么感受？",
        "这件事触动了你什么？",
      ],
      family: [
        "那会儿心里难受不？",
        "心情怎么样，跟咱说说？",
      ],
    };
    return `${opening}${qs[personality][Math.floor(Math.random() * qs[personality].length)]}`;
  }

  if (!hasOpinion) {
    const qs: Record<Personality, string[]> = {
      friend: [
        "这件事你怎么看呀？",
        "你觉得这说明了什么？",
        "你为什么会这么想呢？",
      ],
      wise: [
        "这件事让你对什么有了新的认识？",
        "你觉得这背后告诉了你什么道理？",
      ],
      family: [
        "那你是怎么想的呢？",
        "你觉得这事咋样？",
      ],
    };
    return `${opening}${qs[personality][Math.floor(Math.random() * qs[personality].length)]}`;
  }

  if (!hasLesson) {
    const qs: Record<Personality, string[]> = {
      friend: [
        "这件事让你学到了什么呀？",
        "如果以后再遇到，你会怎么做？",
        "这段经历带给你什么改变？",
      ],
      wise: [
        "这段经历给了你什么智慧？",
        "如果对年轻的自己说句话，你会说什么？",
      ],
      family: [
        "这事让你明白了什么道理？",
        "以后咱就知道该咋办了，对吧？",
      ],
    };
    return `${opening}${qs[personality][Math.floor(Math.random() * qs[personality].length)]}`;
  }

  if (!hasDecision) {
    const qs: Record<Personality, string[]> = {
      friend: ["那接下来你有什么打算吗？", "这件事会让你以后怎么做呢？"],
      wise: ["这些感悟会让你的生活有什么不同？", "你打算如何把这份理解融入生活？"],
      family: ["那咱以后该咋做才好呢？", "这下心里有数了吧？"],
    };
    return `${opening}${qs[personality][Math.floor(Math.random() * qs[personality].length)]}`;
  }

  if (!hasWisdom) {
    const qs: Record<Personality, string[]> = {
      friend: ["这段经历让你对生活有了什么新的认识？", "你有没有发现什么以前没注意到的事？"],
      wise: ["这让你对人生有了什么新的理解？", "这件事让你看清了什么本质？"],
      family: ["这事让你看明白啥了没？", "活到老学到老，咱又长见识了对吧？"],
    };
    return `${opening}${qs[personality][Math.floor(Math.random() * qs[personality].length)]}`;
  }

  return null;
}

// ── Token usage tracking ──

export type Usage = { prompt: number; completion: number; total: number };
export type AiResult<T> = { data: T; usage: Usage | null };

// ── Person & Insight Extraction ──

export type ExtractionResult = {
  people: Array<{ name: string; traits: string[]; event: string; relationship: string }>;
  userInsights: Array<{ category: string; content: string }>;
};

export async function extractPeopleAndInsights(
  content: string,
  followups: FollowupRound[] = []
): Promise<AiResult<ExtractionResult>> {
  let conversation = `用户记录：${content}\n`;
  if (followups.length > 0) {
    conversation += "\n追问与回答：\n";
    followups.forEach((r, i) => {
      conversation += `问：${r.question}\n答：${r.answer}\n`;
    });
  }

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
            content: `你是一个分析日记的助手。请从用户的记录中提取两类结构化信息：

1. 提到的其他人：记录中出现的人名、特征、事件、与用户的关系
2. 用户自身的洞察：反映出的价值观、信念、性格特质、人生感悟、目标

请只返回严格的JSON格式，不要包含其他文字：

{
  "people": [
    {
      "name": "人名（如"大儿子""妈妈""老王"）",
      "traits": ["特征词1", "特征词2"],
      "event": "关于这个人的一两句话的关键事件",
      "relationship": "与用户的关系（如"儿子""母亲""同事"）"
    }
  ],
  "userInsights": [
    {
      "category": "value|belief|trait|life_lesson|goal",
      "content": "简洁有实质内容的一条洞察"
    }
  ]
}

如果记录中没有提到其他人，people数组为空。`,
          },
          {
            role: "user",
            content: conversation,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const usage = data.usage
        ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens, total: data.usage.total_tokens }
        : null;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        return {
          data: {
            people: Array.isArray(parsed.people) ? parsed.people : [],
            userInsights: Array.isArray(parsed.userInsights) ? parsed.userInsights : [],
          },
          usage,
        };
      }
    }
  } catch (e) {
    console.error("Extraction error:", e);
  }

  // Fallback: local extraction when DeepSeek is unavailable
  return { data: localExtract(content, followups), usage: null };
}

function localExtract(
  content: string,
  followups: FollowupRound[] = []
): ExtractionResult {
  const allText = [content, ...followups.flatMap((r) => [r.question, r.answer])].join(" ");

  // Detect commonly mentioned relationship terms (longer names first to avoid substring dupes)
  const relationPatterns: { name: string; relationship: string }[] = [
    { name: "大儿子", relationship: "儿子" },
    { name: "小儿子", relationship: "儿子" },
    { name: "大女儿", relationship: "女儿" },
    { name: "小女儿", relationship: "女儿" },
    { name: "妈妈", relationship: "母亲" },
    { name: "爸爸", relationship: "父亲" },
    { name: "父亲", relationship: "父亲" },
    { name: "母亲", relationship: "母亲" },
    { name: "老婆", relationship: "妻子" },
    { name: "老公", relationship: "丈夫" },
    { name: "妻子", relationship: "妻子" },
    { name: "丈夫", relationship: "丈夫" },
    { name: "爷爷", relationship: "爷爷" },
    { name: "奶奶", relationship: "奶奶" },
    { name: "朋友", relationship: "朋友" },
    { name: "同事", relationship: "同事" },
  ];

  const dedupNames = new Set<string>();
  const people: ExtractionResult["people"] = [];
  for (const pat of relationPatterns) {
    if (allText.includes(pat.name) && !dedupNames.has(pat.name)) {
      dedupNames.add(pat.name);
      // Skip if a longer name that contains this one was already matched
      let skip = false;
      for (const matched of dedupNames) {
        if (matched !== pat.name && matched.includes(pat.name)) { skip = true; break; }
      }
      if (skip) continue;
      const idx = allText.indexOf(pat.name);
      const context = allText.slice(idx + pat.name.length, idx + pat.name.length + 30).replace(/[。，！？\n].*/, "").trim();
      const event = context ? `${pat.name}${context}` : `提到了${pat.name}`;
      people.push({
        name: pat.name,
        traits: [],
        event,
        relationship: pat.relationship,
      });
    }
  }

  // Simple insight extraction from reflection phrases
  const insights: ExtractionResult["userInsights"] = [];
  const sentences = allText.split(/[。！？\n]/).map((s) => s.trim()).filter(Boolean);

  const lessonPattern = /学到|明白|懂得|教训|以后要|应该要|需要|必须|会[更好更差]|改变|成长/;
  const valuePattern = /重要|珍惜|在乎|值得|应该|对[错好]|有意义/;
  const emotionPattern = /开心|难过|高兴|伤心|焦虑|感动|失望|幸福|痛苦|喜欢|讨厌/;

  for (const s of sentences) {
    if (lessonPattern.test(s) && s.length > 4) {
      insights.push({ category: "life_lesson", content: s });
      break;
    }
  }
  for (const s of sentences) {
    if (valuePattern.test(s) && s.length > 4) {
      insights.push({ category: "value", content: s });
      break;
    }
  }
  for (const s of sentences) {
    if (emotionPattern.test(s) && s.length > 4) {
      insights.push({ category: "trait", content: s });
      break;
    }
  }

  return { people, userInsights: insights };
}

export function getRandomTopic(): string {
  const topics = [
    "你小时候生活在什么样的地方？",
    "你记忆中最深刻的童年经历是什么？",
    "你年轻时做过最有勇气的事是什么？",
    "你觉得人最重要的品质是什么？",
    "你相信命运吗？为什么？",
    "你希望未来被记住的是什么？",
    "你最近在想什么？",
    "你觉得什么样的生活才算好生活？",
    "你从失败中学到最多的是什么？",
    "你做过最正确的决定是什么？",
    "你人生中最重要的转折点是什么？",
    "你希望自己更早明白的道理是什么？",
    "如果回到十年前，你会给自己什么建议？",
    "你觉得你身上最像你父母的是什么？",
    "你希望你的孩子从你身上学到什么？",
  ];
  return topics[Math.floor(Math.random() * topics.length)];
}
