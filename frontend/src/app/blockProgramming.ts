export type BlockType =
  | "print_text"
  | "print_variable"
  | "set_variable"
  | "increment_variable"
  | "input_variable"
  | "repeat_times"
  | "repeat_range"
  | "for_each"
  | "if_condition"
  | "elif_condition"
  | "else_branch"
  | "while_condition"
  | "break_loop"
  | "continue_loop"
  | "comment";

export interface BlockFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  width?: "wide";
}

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: "output" | "variables" | "logic" | "loops" | "notes";
  description: string;
  fields: BlockFieldDefinition[];
  opensScope?: boolean;
}

export interface BlockNode {
  id: string;
  type: BlockType;
  indent: number;
  params: Record<string, string>;
}

export interface BlockAssignmentConfig {
  goal?: string;
  hints: string[];
  allowed_blocks?: BlockType[];
  starter_blocks?: BlockNode[];
}

export interface BlockSubmissionPayload {
  kind: "blocks-program";
  version: 1;
  blocks: BlockNode[];
  generated_code: string;
}

type BlockConfigPayload = {
  goal?: unknown;
  hints?: unknown;
  allowed_blocks?: unknown;
  starter_blocks?: unknown;
};

const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  print_text: {
    type: "print_text",
    label: "Вывести текст",
    category: "output",
    description: "Печатает строку на экран.",
    fields: [{ key: "text", label: "Текст", placeholder: "Привет, мир!", defaultValue: "Привет, мир!", width: "wide" }],
  },
  print_variable: {
    type: "print_variable",
    label: "Вывести переменную",
    category: "output",
    description: "Печатает значение переменной.",
    fields: [{ key: "variable", label: "Переменная", placeholder: "name", defaultValue: "name" }],
  },
  set_variable: {
    type: "set_variable",
    label: "Задать переменную",
    category: "variables",
    description: "Присваивает значение переменной.",
    fields: [
      { key: "variable", label: "Переменная", placeholder: "count", defaultValue: "count" },
      { key: "value", label: "Значение", placeholder: "0 или 'текст'", defaultValue: "0", width: "wide" },
    ],
  },
  increment_variable: {
    type: "increment_variable",
    label: "Увеличить переменную",
    category: "variables",
    description: "Увеличивает значение переменной на число.",
    fields: [
      { key: "variable", label: "Переменная", placeholder: "count", defaultValue: "count" },
      { key: "value", label: "На сколько", placeholder: "1", defaultValue: "1" },
    ],
  },
  input_variable: {
    type: "input_variable",
    label: "Спросить у пользователя",
    category: "variables",
    description: "Сохраняет ответ пользователя в переменную.",
    fields: [
      { key: "variable", label: "Переменная", placeholder: "name", defaultValue: "name" },
      { key: "prompt", label: "Подсказка", placeholder: "Как тебя зовут?", defaultValue: "Как тебя зовут?", width: "wide" },
    ],
  },
  repeat_times: {
    type: "repeat_times",
    label: "Повторить несколько раз",
    category: "loops",
    description: "Открывает цикл for по количеству раз.",
    fields: [{ key: "times", label: "Сколько раз", placeholder: "3", defaultValue: "3" }],
    opensScope: true,
  },
  repeat_range: {
    type: "repeat_range",
    label: "Цикл по диапазону",
    category: "loops",
    description: "Цикл for с переменной и диапазоном.",
    fields: [
      { key: "variable", label: "Переменная", placeholder: "i", defaultValue: "i" },
      { key: "start", label: "Старт", placeholder: "0", defaultValue: "0" },
      { key: "end", label: "Конец", placeholder: "10", defaultValue: "10" },
      { key: "step", label: "Шаг", placeholder: "1", defaultValue: "1" },
    ],
    opensScope: true,
  },
  for_each: {
    type: "for_each",
    label: "Цикл по списку",
    category: "loops",
    description: "Цикл for по элементам коллекции.",
    fields: [
      { key: "variable", label: "Элемент", placeholder: "item", defaultValue: "item" },
      { key: "collection", label: "Коллекция", placeholder: "items", defaultValue: "items", width: "wide" },
    ],
    opensScope: true,
  },
  if_condition: {
    type: "if_condition",
    label: "Если условие",
    category: "logic",
    description: "Открывает ветку if.",
    fields: [{ key: "condition", label: "Условие", placeholder: "score > 10", defaultValue: "score > 10", width: "wide" }],
    opensScope: true,
  },
  elif_condition: {
    type: "elif_condition",
    label: "Иначе если",
    category: "logic",
    description: "Добавляет ветку elif.",
    fields: [{ key: "condition", label: "Условие", placeholder: "score > 20", defaultValue: "score > 20", width: "wide" }],
    opensScope: true,
  },
  else_branch: {
    type: "else_branch",
    label: "Иначе",
    category: "logic",
    description: "Запускает альтернативную ветку else.",
    fields: [],
    opensScope: true,
  },
  while_condition: {
    type: "while_condition",
    label: "Пока условие",
    category: "loops",
    description: "Открывает цикл while.",
    fields: [{ key: "condition", label: "Условие", placeholder: "x < 10", defaultValue: "x < 10", width: "wide" }],
    opensScope: true,
  },
  break_loop: {
    type: "break_loop",
    label: "Выйти из цикла",
    category: "loops",
    description: "Прерывает выполнение цикла.",
    fields: [],
  },
  continue_loop: {
    type: "continue_loop",
    label: "Пропустить шаг",
    category: "loops",
    description: "Переходит к следующей итерации цикла.",
    fields: [],
  },
  comment: {
    type: "comment",
    label: "Комментарий",
    category: "notes",
    description: "Добавляет пояснение в код.",
    fields: [{ key: "text", label: "Комментарий", placeholder: "Что делает алгоритм", defaultValue: "Описание шага", width: "wide" }],
  },
};

const DEFAULT_ALLOWED_BLOCKS: BlockType[] = [
  "print_text",
  "print_variable",
  "set_variable",
  "increment_variable",
  "input_variable",
  "repeat_times",
  "repeat_range",
  "for_each",
  "if_condition",
  "elif_condition",
  "else_branch",
  "while_condition",
  "break_loop",
  "continue_loop",
  "comment",
];

export const DEFAULT_BLOCK_ASSIGNMENT_TEMPLATE = JSON.stringify(
  {
    goal: "Собери программу из блоков и получи готовый Python-код.",
    hints: [
      "В блоке 'Значение' можно писать Python-выражения: 0, 5, 'Привет'.",
      "Чтобы вложить блоки в цикл или условие, сдвинь их вправо кнопкой '>>'.",
    ],
    allowed_blocks: DEFAULT_ALLOWED_BLOCKS,
    starter_blocks: [
      { type: "input_variable", params: { variable: "name", prompt: "Как тебя зовут?" } },
      { type: "print_text", params: { text: "Привет!" } },
      { type: "print_variable", params: { variable: "name" } },
    ],
  },
  null,
  2,
);

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const normalized = trimmed.replace(/[^\w\u0400-\u04ff]+/g, "_").replace(/^(\d)/, "_$1");
  return normalized || fallback;
}

function wrapPythonString(value: string, fallback: string): string {
  const source = value.trim() || fallback;
  return JSON.stringify(source);
}

function normalizeExpression(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function isKnownBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && value in BLOCK_DEFINITIONS;
}

const LEGACY_BLOCK_ALIASES: Record<string, BlockType> = {
  input: "input_variable",
  print: "print_text",
  if: "if_condition",
  elif: "elif_condition",
  else: "else_branch",
  while: "while_condition",
};

function resolveBlockType(value: unknown): BlockType | null {
  if (isKnownBlockType(value)) return value;
  if (typeof value === "string" && value in LEGACY_BLOCK_ALIASES) {
    return LEGACY_BLOCK_ALIASES[value];
  }
  return null;
}

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_DEFINITIONS[type];
}

export function createBlock(
  type: BlockType,
  options: Partial<Pick<BlockNode, "indent">> & { params?: Record<string, string> } = {},
): BlockNode {
  const definition = getBlockDefinition(type);
  const params: Record<string, string> = {};

  definition.fields.forEach((field) => {
    params[field.key] = options.params?.[field.key] ?? field.defaultValue;
  });

  return {
    id: createId(),
    type,
    indent: Math.max(0, options.indent ?? 0),
    params,
  };
}

export function parseBlockAssignmentConfig(rawPayload: string | null): BlockAssignmentConfig {
  if (!rawPayload) {
    return { hints: [] };
  }

  try {
    const parsed = JSON.parse(rawPayload) as BlockConfigPayload;
    const allowedBlocks = Array.isArray(parsed.allowed_blocks)
      ? parsed.allowed_blocks.map(resolveBlockType).filter((item): item is BlockType => item !== null)
      : undefined;
    const hints = Array.isArray(parsed.hints)
      ? parsed.hints.filter((item): item is string => typeof item === "string")
      : typeof (parsed as { hint?: unknown }).hint === "string"
        ? [String((parsed as { hint?: unknown }).hint)]
        : [];
    const goal = typeof parsed.goal === "string" ? parsed.goal : undefined;
    const starterBlocks = Array.isArray(parsed.starter_blocks)
      ? parsed.starter_blocks
          .map((block, index) => {
            if (typeof block === "string") {
              const type = resolveBlockType(block);
              if (!type) return null;
              const indent = index === 0 ? 0 : undefined;
              return createBlock(type, { indent });
            }

            if (!block || typeof block !== "object") return null;
            const candidate = block as { type?: unknown; indent?: unknown; params?: unknown };
            const type = resolveBlockType(candidate.type);
            if (!type) return null;

            const params =
              candidate.params && typeof candidate.params === "object"
                ? Object.fromEntries(
                    Object.entries(candidate.params).map(([key, value]) => [key, typeof value === "string" ? value : String(value)]),
                  )
                : undefined;
            const indent = typeof candidate.indent === "number" ? candidate.indent : index === 0 ? 0 : undefined;
            return createBlock(type, { indent, params });
          })
          .filter((block): block is BlockNode => block !== null)
      : undefined;

    return {
      goal,
      hints,
      allowed_blocks: allowedBlocks && allowedBlocks.length > 0 ? allowedBlocks : undefined,
      starter_blocks: starterBlocks && starterBlocks.length > 0 ? starterBlocks : undefined,
    };
  } catch {
    return { hints: [] };
  }
}

export function getPaletteForConfig(config: BlockAssignmentConfig): BlockDefinition[] {
  const allowed = config.allowed_blocks && config.allowed_blocks.length > 0 ? config.allowed_blocks : DEFAULT_ALLOWED_BLOCKS;
  return allowed.map((type) => getBlockDefinition(type));
}

export function createStarterProgram(config: BlockAssignmentConfig): BlockNode[] {
  if (config.starter_blocks && config.starter_blocks.length > 0) {
    return config.starter_blocks.map((block) =>
      createBlock(block.type, {
        indent: block.indent,
        params: block.params,
      }),
    );
  }

  return [createBlock("print_text")];
}

function renderBlockToPython(block: BlockNode): string {
  switch (block.type) {
    case "print_text":
      return `print(${wrapPythonString(block.params.text ?? "", "Текст")})`;
    case "print_variable":
      return `print(${sanitizeIdentifier(block.params.variable ?? "", "value")})`;
    case "set_variable":
      return `${sanitizeIdentifier(block.params.variable ?? "", "value")} = ${normalizeExpression(block.params.value ?? "", "0")}`;
    case "increment_variable":
      return `${sanitizeIdentifier(block.params.variable ?? "", "count")} += ${normalizeExpression(block.params.value ?? "", "1")}`;
    case "input_variable":
      return `${sanitizeIdentifier(block.params.variable ?? "", "answer")} = input(${wrapPythonString(block.params.prompt ?? "", "Введите значение")})`;
    case "repeat_times":
      return `for _ in range(${normalizeExpression(block.params.times ?? "", "1")}):`;
    case "repeat_range":
      return `for ${sanitizeIdentifier(block.params.variable ?? "", "i")} in range(${normalizeExpression(block.params.start ?? "", "0")}, ${normalizeExpression(block.params.end ?? "", "10")}, ${normalizeExpression(block.params.step ?? "", "1")}):`;
    case "for_each":
      return `for ${sanitizeIdentifier(block.params.variable ?? "", "item")} in ${normalizeExpression(block.params.collection ?? "", "items")}:`;
    case "if_condition":
      return `if ${normalizeExpression(block.params.condition ?? "", "True")}:`;
    case "elif_condition":
      return `elif ${normalizeExpression(block.params.condition ?? "", "True")}:`;
    case "else_branch":
      return "else:";
    case "while_condition":
      return `while ${normalizeExpression(block.params.condition ?? "", "True")}:`;
    case "break_loop":
      return "break";
    case "continue_loop":
      return "continue";
    case "comment":
      return `# ${block.params.text?.trim() || "Комментарий"}`;
  }
}

export function generatePythonFromBlocks(blocks: BlockNode[]): string {
  if (blocks.length === 0) {
    return "# Добавьте блоки, чтобы получить код";
  }

  return blocks
    .map((block) => `${"    ".repeat(Math.max(0, block.indent))}${renderBlockToPython(block)}`)
    .join("\n");
}

export function serializeBlockSubmission(blocks: BlockNode[]): string {
  const payload: BlockSubmissionPayload = {
    kind: "blocks-program",
    version: 1,
    blocks,
    generated_code: generatePythonFromBlocks(blocks),
  };

  return JSON.stringify(payload, null, 2);
}

export function parseBlockSubmissionPayload(rawPayload: string): BlockSubmissionPayload | null {
  try {
    const parsed = JSON.parse(rawPayload) as Partial<BlockSubmissionPayload>;
    if (parsed.kind !== "blocks-program" || parsed.version !== 1 || !Array.isArray(parsed.blocks)) {
      return null;
    }

    const blocks = parsed.blocks
      .filter((block): block is BlockNode => {
        if (!block || typeof block !== "object") return false;
        const candidate = block as Partial<BlockNode>;
        return typeof candidate.id === "string" && isKnownBlockType(candidate.type);
      })
      .map((block) =>
        createBlock(block.type, {
          indent: typeof block.indent === "number" ? block.indent : 0,
          params: block.params,
        }),
      );

    return {
      kind: "blocks-program",
      version: 1,
      blocks,
      generated_code: generatePythonFromBlocks(blocks),
    };
  } catch {
    return null;
  }
}
