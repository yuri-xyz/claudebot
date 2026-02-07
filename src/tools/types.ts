import type { z } from "zod";

export interface ToolDefinition<
  T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
> {
  name: string;
  description: string;
  inputShape: T;
  handler: (input: z.objectOutputType<T, z.ZodTypeAny>) => Promise<string>;
}
