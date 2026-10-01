import { popularityWeights } from '../config/constants.js';

/**
 * popularityScore = views*wV + downloads*wD + likes*wL + upvotes*wU
 * // SRS-54..72
 */
export function computePopularityScore(stats = {}) {
  const views = Number(stats.views) || 0;
  const downloads = Number(stats.downloads) || 0;
  const likes = Number(stats.likesCount) || 0;
  const upvotes = Number(stats.upvotesCount) || 0;

  return (
    views * popularityWeights.views +
    downloads * popularityWeights.downloads +
    likes * popularityWeights.likes +
    upvotes * popularityWeights.upvotes
  );
}

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
