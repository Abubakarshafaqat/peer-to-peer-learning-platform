# Data model (Phase 0)

| Collection | Key fields | Relationships / indexes |
|---|---|---|
| **User** | fullName, username*, email*, phone, passwordHash, role (`student\|admin`), avatarUrl, university, isActive, awayMode, lastSeenAt, resetOtp | → University; unique username, email |
| **University** | name, slug* | unique slug |
| **Course** | name, slug, university | → University; unique (university, slug) |
| **Subject** | name, slug, course | → Course; unique (course, slug) |
| **Material** | title, description, type, file, tags, status, rejectionReason, stats, popularityScore | → uploader, university, course, subject; text + compound indexes (Phase 2–3) |
| **Comment** | body, parent? | polymorphic target; → author |
| **Reaction** | kind (`like\|upvote`) | unique (user, targetType, target, kind) |
| **Review** | rating, text | unique (material, user) |
| **Question / Answer** | Q&A fields | → subject/course/material, author |
| **Report** | reason, status | polymorphic target |
| **Conversation / Message** | participants, body, readBy, isAiReply | 1:1 chat |
| **Notification** | type, payload, isRead | → user |
| **ActivityLog** | action, meta | audit + activity |
| **QuizQuestion** | prompt, options, difficulty, status | → taxonomy, author |
| **QuizAttempt** | config, answers, score | → user |
| **AiChatSession** | messages[] | → user |

\*unique. Schemas for User + taxonomy implemented in Phase 0 for seeding; remaining models land with their phases.
