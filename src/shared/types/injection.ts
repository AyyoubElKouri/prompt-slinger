export const INJECT_MESSAGE = 'INJECT_PROMPT' as const;

export type InjectRequest = {
  type: typeof INJECT_MESSAGE;
  text: string;
};

export type InjectResponse = { ok: true } | { ok: false; error: string };
