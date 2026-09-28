/**
 * AI service stub (OpenAI server-side only — Phase 8).
 */
export class AiService {
  async chat(_messages, _options = {}) {
    throw new Error('AiService.chat not implemented (Phase 8)');
  }
}

export const aiService = new AiService();
