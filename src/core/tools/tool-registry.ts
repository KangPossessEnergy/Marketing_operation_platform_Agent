import { z } from 'zod';
import { jsonSchema } from 'ai';

export type ToolParameters = z.ZodTypeAny | Record<string, unknown>;

export type InferToolInput<T extends ToolParameters> = T extends z.ZodTypeAny
  ? z.infer<T>
  : Record<string, any>;

export interface ToolDefinition<TParams extends ToolParameters = ToolParameters> {
  name: string;
  description: string;
  parameters: TParams;
  isConcurrencySafe?: boolean;
  isReadOnly?: boolean;
  maxResultChars?: number;
  execute: (input: InferToolInput<TParams>) => Promise<unknown>;
  profile?: string[];
  shouldDefer?: boolean;
  searchHint?: string;
}

export function isZodSchema(schema: unknown): schema is z.ZodTypeAny {
  return (
    schema != null &&
    typeof schema === 'object' &&
    ('safeParse' in schema || '_def' in schema || '~standard' in schema)
  );
}

export function defineTool<TParams extends ToolParameters>(
  definition: ToolDefinition<TParams>,
): ToolDefinition<TParams> {
  return definition;
}

const DEFAULT_MAX_RESULT_CHARS = 3000;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition<any>>();

  register(...tools: ToolDefinition<any>[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): ToolDefinition<any> | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition<any>[] {
    return Array.from(this.tools.values());
  }

  toAISDKFormat(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, tool] of this.tools) {
      const maxChars = tool.maxResultChars;
      const executeFn = tool.execute;
      const rawSchema = tool.parameters;

      const isZod = isZodSchema(rawSchema);
      const inputSchema = isZod ? rawSchema : jsonSchema(rawSchema as any);

      result[name] = {
        description: tool.description,
        inputSchema,
        execute: async (input: any) => {
          let validatedInput = input;

          if (isZod) {
            const parseResult = (rawSchema as z.ZodTypeAny).safeParse(input);
            if (!parseResult.success) {
              const formattedErrors = parseResult.error.issues
                ? parseResult.error.issues
                    .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
                    .join('; ')
                : parseResult.error.message;
              return `【参数校验失败】工具 "${name}" 入参不合法: ${formattedErrors}`;
            }
            validatedInput = parseResult.data;
          }

          try {
            const raw = await executeFn(validatedInput);
            const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
            return truncateResult(text, maxChars);
          } catch (err: any) {
            return `【工具执行出错】${err?.message || String(err)}`;
          }
        },
      };
    }
    return result;
  }
}

export function truncateResult(text: string, maxChars: number = DEFAULT_MAX_RESULT_CHARS): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = maxChars - headSize;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  const dropped = text.length - headSize - tailSize;

  return `${head}\n\n... [省略 ${dropped} 字符] ...\n\n${tail}`;
}
