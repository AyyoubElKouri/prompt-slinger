import type { Prompt } from '../../shared/types/prompt';
import { PromptsView } from '../../features/prompts/prompts.ui';

const samplePrompts: Prompt[] = [
  {
    id: 'code-review.md',
    name: 'Senior code reviewer',
    iconName: 'code-xml',
    body: 'Review this code.',
    fileName: 'code-review.md',
    relativePath: 'code-review.md',
  },
  {
    id: 'explain-simply.md',
    name: 'Explain it like I’m new',
    iconName: 'lightbulb',
    body: 'Explain this simply.',
    fileName: 'explain-simply.md',
    relativePath: 'explain-simply.md',
  },
  {
    id: 'refactor.md',
    name: 'Refactor for clarity',
    iconName: 'refresh-cw',
    body: 'Refactor this.',
    fileName: 'refactor.md',
    relativePath: 'refactor.md',
  },
];

export default function App() {
  return (
    <PromptsView
      title="Prompt Shelf"
      count={12}
      query=""
      onQueryChange={() => undefined}
      items={samplePrompts}
      activeId={null}
      status={null}
      emptyMessage={null}
      onReload={() => undefined}
      onChooseFolder={() => undefined}
      onInject={() => undefined}
    />
  );
}
