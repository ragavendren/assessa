export type HelpAudience = "all" | "admin";

export type FaqItem = {
  id: string;
  category: string;
  /** Compact chip label shown in the Ask chat. */
  tag: string;
  question: string;
  answer: string;
  audience: HelpAudience;
};

export const FAQ_TOPIC_PROMPTS: Record<string, string> = {
  "Getting started":
    "Assessa is papers plus Play. Daily, Weekly, and assigned assessments are the required loop.",
  "Daily Play": "One 10-question run per calendar day when Daily is on. It keeps your streak.",
  "Weekly Play": "One longer run per week when Weekly is on. It ranks on the weekly board.",
  "Play modes": "Everything else in Play is optional practice or a hosted event.",
  Assessments: "Official timed papers with a pass mark. They are not Play.",
  "XP & badges": "XP raises your level. Badges come from admin rules.",
  Leaderboard: "Assessment ranks for people who have not opted out. Play has its own boards.",
  Profile: "Organisation and team control which papers you can sit.",
  Admin: "Assessments are papers. Library (courses, pools, blueprints) feeds both papers and Play.",
};

export type TourStep = {
  id: string;
  target: string | null;
  title: string;
  body: string;
  audience: HelpAudience;
  /** Skip this step when Play is turned off. */
  requiresPlay?: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-assessa",
    category: "Getting started",
    tag: "What is Assessa?",
    question: "What is Assessa?",
    answer:
      "Assessa is the assessment and practice hub for your organisation. Formal papers live under Assessments. Short pool games live under Play. Your dashboard pulls both together with XP, streaks, and badges.",
    audience: "all",
  },
  {
    id: "what-is-required",
    category: "Getting started",
    tag: "What's required?",
    question: "What am I required to complete?",
    answer:
      "Three things, when they are switched on for you: (1) Daily Challenge — once per calendar day, to keep your Play streak. (2) Weekly Challenge — once per week, which ranks on the weekly board. (3) Any published assessment assigned to you, within its window and attempt limit. Other Play modes (speed, flash, survival, Live Arena, and so on) are optional practice.",
    audience: "all",
  },
  {
    id: "first-session",
    category: "Getting started",
    tag: "First visit",
    question: "What should I do on my first visit?",
    answer:
      "Finish organisation and team on the profile gate, then open the dashboard. Complete today’s Daily Challenge if it is live, then any Weekly Challenge still open this week, then any available assessment. Use the Ask button at the bottom right anytime, or take the header tour.",
    audience: "all",
  },
  {
    id: "daily",
    category: "Daily Play",
    tag: "Daily Challenge",
    question: "How does the Daily Challenge work?",
    answer:
      "When an admin enables Daily, you get one 10-question, 10-minute run per calendar day. Finishing it awards XP and continues your day streak. You cannot replay the same day. Results stay on Play after you submit.",
    audience: "all",
  },
  {
    id: "weekly",
    category: "Weekly Play",
    tag: "Weekly Challenge",
    question: "How does the Weekly Challenge work?",
    answer:
      "When Weekly is enabled, you get one longer run per week. Completing it is required for that week’s Play standing. Top ranks can earn a badge, depending on how gamification is configured.",
    audience: "all",
  },
  {
    id: "play-vs-assessments",
    category: "Play modes",
    tag: "Play vs paper",
    question: "Is Play the same as an assessment?",
    answer:
      "No. Play draws from question pools the admin binds to a course or activity. Assessments are separate papers with a pass mark, timer, attempt limit, and official result. Play never clones your exam paper.",
    audience: "all",
  },
  {
    id: "other-play",
    category: "Play modes",
    tag: "Optional modes",
    question: "What are the optional Play modes?",
    answer:
      "Topic, Speed, Survival, Rapid Fire, Marathon, Flash Cards, Battle, Team, Escape, knockout, and Live Arena can appear when an admin turns them on. They are extra practice or hosted events, not a daily obligation.",
    audience: "all",
  },
  {
    id: "assessments",
    category: "Assessments",
    tag: "How papers work",
    question: "How do formal assessments work?",
    answer:
      "Open Assessments to see available, upcoming, in-progress, and completed papers. Each paper shows duration, pass mark, and attempts remaining. Start only when you can finish in one sitting unless the paper allows resume. Results and review appear after submit.",
    audience: "all",
  },
  {
    id: "xp-badges",
    category: "XP & badges",
    tag: "XP & badges",
    question: "How do XP, levels, and badges work?",
    answer:
      "XP from Play and from assessments (when the paper has XP enabled) raises your level in the header chip. Badges are awarded from admin-configured rules — streaks, scores, pass counts, and similar. Achievements lists everything you have earned.",
    audience: "all",
  },
  {
    id: "leaderboard",
    category: "Leaderboard",
    tag: "Ranks",
    question: "What does the leaderboard show?",
    answer:
      "The main leaderboard ranks assessment performance for people who have not opted out. Play has its own boards (daily, weekly, and mode-specific). Admins are excluded from participant leaderboards.",
    audience: "all",
  },
  {
    id: "profile",
    category: "Profile",
    tag: "Org & team",
    question: "Why do organisation and team matter?",
    answer:
      "They control which papers you can sit and how leaderboards group people. Names must match what the admin configured. You can update display name, avatar, and leaderboard opt-out later on Profile.",
    audience: "all",
  },
  {
    id: "admin-nav",
    category: "Admin",
    tag: "Admin nav",
    question: "Where do I manage the platform without jumping tabs?",
    answer:
      "Open Admin in the header. Overview is cohort plus paper performance. Assessments manages papers. Courses, Pools, and Blueprints are the library for both papers and Play. Play and XP sit in their own group.",
    audience: "admin",
  },
  {
    id: "admin-question-bank",
    category: "Admin",
    tag: "Author a paper",
    question: "What is the authoring path for a paper?",
    answer:
      "Create a Course, add questions in a Pool, optionally a Blueprint. Then create the paper under Assessments. Leave blueprint on Random selection unless you need a specific mix. Play binds to the same pools, not the paper.",
    audience: "admin",
  },
  {
    id: "admin-play",
    category: "Admin",
    tag: "Required Play",
    question: "How do I turn required Play on?",
    answer:
      "In Play control, switch the Play menu on, then enable Daily and Weekly and bind each to a course or activity plus a pool. Participants then see those as Required today on the dashboard. Host Live Arena and escape rooms from the same Play screen.",
    audience: "admin",
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Mandatory insights in one minute",
    body: "Assessa has a short required loop: Daily Play, Weekly Play, and any published assessment assigned to you. Everything else is practice, badges, or hosted events. This tour points at the places that matter.",
    audience: "all",
  },
  {
    id: "dashboard",
    target: "[data-tour='nav-dashboard']",
    title: "Dashboard is home",
    body: "Start here each session. Required Play cards, available papers, streaks, and XP land on this page so you do not have to hunt.",
    audience: "all",
  },
  {
    id: "play",
    target: "[data-tour='nav-play']",
    title: "Play: daily and weekly first",
    body: "When Play is on, Daily (once a day) and Weekly (once a week) are the required modes. Other games are optional. Live Arena and escape rooms are hosted events you join when an admin opens them.",
    audience: "all",
    requiresPlay: true,
  },
  {
    id: "assessments",
    target: "[data-tour='nav-assessments']",
    title: "Assessments are the official papers",
    body: "These are timed, marked papers with a pass mark and attempt limit. They are not the same as Play. Sit them inside the published window.",
    audience: "all",
  },
  {
    id: "xp",
    target: "[data-tour='hud-xp']",
    title: "XP and level stay in the header",
    body: "Play finishes and XP-enabled papers add to this chip. Levels and badge rules are configured by an admin under XP.",
    audience: "all",
  },
  {
    id: "achievements",
    target: "[data-tour='nav-achievements']",
    title: "Achievements collect badges",
    body: "Earned badges, tracks, and progress live here. Nothing here is mandatory — it reflects what you already completed.",
    audience: "all",
  },
  {
    id: "leaderboard",
    target: "[data-tour='nav-leaderboard']",
    title: "Leaderboard is opt-in ranking",
    body: "Assessment ranks for people who have not opted out. Play has its own boards inside Play. You can hide your name from Profile.",
    audience: "all",
  },
  {
    id: "help",
    target: "[data-tour='help']",
    title: "Ask from the corner",
    body: "The Ask button stays bottom-right. Pick a topic, then a question tag, and the answer appears in the chat. Replay this tour from the header compass anytime.",
    audience: "all",
  },
  {
    id: "admin",
    target: "[data-tour='nav-admin']",
    title: "Admin is one grouped bar",
    body: "Assessments vs Play: papers are under Assessments. Courses, pools, and blueprints feed both. Overview shows cohort stats and paper performance.",
    audience: "admin",
  },
];

export function faqItemsFor(isAdmin: boolean): FaqItem[] {
  return FAQ_ITEMS.filter(
    (item) => item.audience === "all" || (isAdmin && item.audience === "admin"),
  );
}

export function faqCategories(items: FaqItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    if (!seen.includes(item.category)) seen.push(item.category);
  }
  return seen;
}

export function faqItemsInTopic(items: FaqItem[], topic: string): FaqItem[] {
  return items.filter((item) => item.category === topic);
}

export function relatedFaqItems(item: FaqItem, items: FaqItem[], limit = 3): FaqItem[] {
  return items
    .filter((row) => row.category === item.category && row.id !== item.id)
    .slice(0, limit);
}

export function tourStepsFor(options: { isAdmin: boolean; playOn: boolean }): TourStep[] {
  return TOUR_STEPS.filter((step) => {
    if (step.audience === "admin" && !options.isAdmin) return false;
    if (step.requiresPlay && !options.playOn) return false;
    return true;
  });
}

export const TOUR_STORAGE_KEY = "assessa:help-tour:v1";
