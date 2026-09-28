/**
 * Popularity score weights — used by M3 search/sort (SRS-54..72).
 * popularityScore = views*wV + downloads*wD + likes*wL + upvotes*wU
 */
export const popularityWeights = {
  views: 1,
  downloads: 3,
  likes: 2,
  upvotes: 4,
};

export const materialTypes = [
  'notes',
  'past_paper',
  'mcq',
  'short_questions',
  'long_questions',
  'other',
];

export const userRoles = ['student', 'admin'];

export const materialStatuses = ['pending', 'approved', 'rejected'];

export const difficulties = ['easy', 'medium', 'hard'];
