export type Prompt = {
  id: string;
  name: string;
  iconName: string;
  body: string;
  fileName: string;
  relativePath: string;
};

export type PromptSnapshot = {
  version: 1;
  folderName: string;
  scannedAt: number;
  prompts: Prompt[];
};

export type ScanResult = {
  prompts: Prompt[];
  capped: boolean;
};
