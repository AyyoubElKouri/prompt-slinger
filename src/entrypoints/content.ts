import { startInjectionContentScript } from '../features/prompts/prompts.content';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    startInjectionContentScript();
  },
});
