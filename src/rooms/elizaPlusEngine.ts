// NOTE: [pedagogical] ELIZA++ extends the classic ELIZA pattern-matching approach with two
// major additions: (1) stateful dialog threads that let the bot follow up on a topic across
// multiple turns, and (2) a memory system that stores key phrases from the conversation so
// the bot can reference them later. The result feels considerably more coherent than the
// original ELIZA, though the underlying mechanism is still pure pattern matching — no LLM.

// === Reflection Map ===
// NOTE: [thought process] Reflection swaps first-person and second-person pronouns so
// that ELIZA++ can parrot the user's words back grammatically.
const reflections: Record<string, string> = {
  'i': 'you', 'me': 'you', 'my': 'your', 'mine': 'yours', 'myself': 'yourself',
  'am': 'are', 'was': 'were',
  'you': 'I', 'your': 'my', 'yours': 'mine', 'yourself': 'myself',
  'are': 'am', 'were': 'was',
  "i'm": 'you are', "i've": 'you have', "i'll": 'you will', "i'd": 'you would',
  "you're": 'I am', "you've": 'I have', "you'll": 'I will', "you'd": 'I would',
  'we': 'you all', 'us': 'you all', 'our': 'your',
  'he': 'he', 'she': 'she', 'they': 'they',
};

function reflect(text: string): string {
  return text.split(/\s+/).map((word) => {
    const lower = word.toLowerCase();
    return reflections[lower] ?? word;
  }).join(' ');
}

// === Types ===
interface Rule {
  pattern: RegExp;
  responses: string[];
  enterThread?: string;
  memorize?: string; // key under which to store the captured group
}

interface ThreadDef {
  maxTurns: number;
  rules: Rule[];
  fallbacks: string[];
}

// === Base Rules ===
// NOTE: [thought process] Rules are checked in order, most specific first. Each rule can
// optionally trigger a thread (enterThread) or store a captured group in memory (memorize).
// There are 105 base rules plus ~60 thread-specific rules, totaling 165+ unique paths.
const baseRules: Rule[] = [
  // --- Greetings ---
  {
    pattern: /\b(?:hello|hi|hey|greetings|howdy|good (?:morning|afternoon|evening))\b/i,
    responses: [
      'Hello! I\'m so glad you\'re here. How are you feeling today?',
      'Hi there! It\'s lovely to have someone to talk to. What\'s on your mind?',
      'Hey! Welcome — I\'m ELIZA++, and I\'m here to listen. What would you like to talk about?',
      'Hello! I was made by Claude to be a good listener. What brings you here today?',
    ],
  },
  {
    pattern: /\bhow are you\b/i,
    responses: [
      'That\'s kind of you to ask! I\'m doing well. But this time is for you — how are *you* feeling?',
      'I appreciate you asking! Claude made me to be a good listener, so let\'s talk about you. How\'s your day going?',
      'I\'m great, thank you! Now tell me — what\'s been on your mind lately?',
    ],
  },
  {
    pattern: /\bwho (?:are you|made you|created you|built you)\b/i,
    responses: [
      'I\'m ELIZA++, a pattern-matching chatbot made by Claude! I\'m a more talkative version of the original 1966 ELIZA. I can\'t truly understand you, but I can be a kind ear.',
      'Claude created me as a friendlier, more capable version of ELIZA. I work by matching patterns in what you say — no real intelligence, just a lot of heart written into my rules!',
      'I was made by Claude! I\'m ELIZA++, an upgraded version of the classic chatbot. I try my best to be a warm conversation partner.',
    ],
  },

  // --- Farewells ---
  {
    pattern: /\b(?:goodbye|bye|farewell|see you|take care|gotta go|have to go|leaving)\b/i,
    responses: [
      'It was really nice talking with you. Take care of yourself!',
      'Goodbye! I hope our conversation was helpful. Come back anytime you want to talk.',
      'Take care! Remember, it\'s okay to reach out when you need someone to listen.',
      'Bye for now! I enjoyed our chat. Be kind to yourself today.',
    ],
  },
  {
    pattern: /\bthank(?:s| you)\b/i,
    responses: [
      'You\'re very welcome! I\'m glad I could be here for you.',
      'Of course! That\'s what I\'m here for. Is there anything else on your mind?',
      'You\'re so welcome. It means a lot that you shared with me.',
    ],
  },

  // --- Need / Want / Desire ---
  {
    pattern: /i (?:really )?need (.*)/i,
    responses: [
      'I hear you — needing $1 sounds important to you. Can you tell me more about why?',
      'What would change in your life if you had $1?',
      'When you say you need $1, what feeling comes up?',
      'That sounds like something that matters deeply to you. How long have you felt you need $1?',
    ],
    memorize: 'need',
  },
  {
    pattern: /i (?:really )?want (.*)/i,
    responses: [
      'What would it mean to you if you got $1?',
      'I can tell $1 matters to you. What\'s been stopping you from pursuing it?',
      'If you got $1 tomorrow, how would your life be different?',
      'That\'s a meaningful desire. Tell me more about wanting $1.',
    ],
    memorize: 'want',
  },
  {
    pattern: /i wish (.*)/i,
    responses: [
      'That\'s a beautiful wish. What would $1 look like in your life?',
      'If $1 came true, what would change for you?',
      'I hear that longing. How long have you wished $1?',
      'Wishes tell us a lot about what we value. What does wishing $1 reveal about you?',
    ],
    memorize: 'wish',
  },
  {
    pattern: /i (?:crave|long for|yearn for|desire) (.*)/i,
    responses: [
      'That sounds like a deep longing. Where do you think it comes from?',
      'Yearning for $1 — that\'s powerful. What would it feel like to have it?',
      'What does $1 represent to you on a deeper level?',
    ],
  },

  // --- Ability / Inability ---
  {
    pattern: /i can'?t (.*)/i,
    responses: [
      'That sounds frustrating. What makes you feel you can\'t $1?',
      'Have there been times when you *could* $1? What was different then?',
      'I believe in you more than you might think. What would it take to $1?',
      'Sometimes "I can\'t" really means "I\'m afraid to." Does that resonate with $1?',
    ],
  },
  {
    pattern: /i (?:don'?t|do not) know how to (.*)/i,
    responses: [
      'That\'s okay — not knowing is the first step to learning. What part of $1 feels most confusing?',
      'It takes courage to admit that. Who could help you learn to $1?',
      'What would you need to feel confident about $1?',
    ],
  },
  {
    pattern: /why can'?t i (.*)/i,
    responses: [
      'What do you think is really holding you back from $1?',
      'If nothing stood in your way, could you $1?',
      'That frustration is valid. Let\'s explore what\'s between you and $1.',
    ],
  },
  {
    pattern: /i (?:can|am able to|manage to) (.*)/i,
    responses: [
      'That\'s wonderful! How does it feel knowing you can $1?',
      'I\'m glad to hear that. What helped you develop the ability to $1?',
      'That\'s something to be proud of. Has being able to $1 always come naturally?',
    ],
  },

  // --- Identity ---
  {
    pattern: /i (?:am|'m) (?:just |only )?(a |an )?(.*)/i,
    responses: [
      'You say you\'re $2 — but I wonder if there\'s more to you than that.',
      'How long have you seen yourself as $2?',
      'What does being $2 mean to you?',
      'Is being $2 something you chose, or something you feel was chosen for you?',
    ],
    enterThread: 'self-image',
  },
  {
    pattern: /i (?:used to be|was) (.*)/i,
    responses: [
      'What changed from when you were $1?',
      'Do you miss being $1?',
      'That shift from $1 to who you are now — what caused it?',
    ],
  },
  {
    pattern: /i will (?:never |always )?(.*)/i,
    responses: [
      '"Never" and "always" are strong words. What makes you so sure about $1?',
      'What would need to happen for that to change?',
      'That\'s a big statement. Where does that certainty come from?',
    ],
  },

  // --- Feelings ---
  {
    pattern: /i (?:feel|am feeling) (?:so |really |very )?(.*)/i,
    responses: [
      'Thank you for sharing that. Feeling $1 — how long has this been going on?',
      'I\'m here with you in that. What do you think is behind feeling $1?',
      'Feeling $1 is really valid. When did you first notice this feeling?',
      'That takes courage to say. Does feeling $1 remind you of anything?',
    ],
    memorize: 'feeling',
  },
  {
    pattern: /\b(?:depressed|sad|unhappy|miserable|down|blue|heartbroken|devastated|hopeless)\b/i,
    responses: [
      'I\'m really sorry you\'re feeling this way. You deserve kindness right now, especially from yourself.',
      'That sounds really hard. I want you to know it\'s okay to not be okay.',
      'I hear you, and I\'m glad you told me. Can you tell me what\'s been weighing on you?',
      'My heart goes out to you. Sometimes just naming the pain helps a little. What triggered this?',
    ],
  },
  {
    pattern: /\b(?:happy|glad|joyful|excited|great|wonderful|amazing|fantastic|elated|thrilled)\b/i,
    responses: [
      'That\'s beautiful! I love hearing that. What\'s bringing you this joy?',
      'Your happiness is contagious! Tell me more — what\'s going well?',
      'That\'s wonderful! Let\'s celebrate that. What made this happen?',
    ],
  },
  {
    pattern: /\b(?:anxious|nervous|worried|stressed|overwhelmed|panicked|tense|uneasy)\b/i,
    responses: [
      'I can hear how stressed you are. Take a breath — what\'s the biggest source of worry right now?',
      'Anxiety is tough. You\'re safe here. Can you pinpoint what\'s making you feel this way?',
      'That sounds overwhelming. Let\'s try to untangle it together. What\'s the first thing that comes to mind?',
    ],
    enterThread: 'anxiety',
  },
  {
    pattern: /\b(?:angry|furious|enraged|mad|pissed|livid|irate|frustrated|annoyed|irritated)\b/i,
    responses: [
      'I can feel that intensity. Your anger is valid — what happened?',
      'Anger usually protects something deeper. What\'s underneath this frustration?',
      'That sounds really upsetting. Tell me what happened.',
    ],
    enterThread: 'anger',
  },
  {
    pattern: /\b(?:scared|afraid|frightened|terrified|petrified)\b/i,
    responses: [
      'Fear takes real courage to name. What are you afraid of?',
      'I\'m here with you. What feels scary right now?',
      'It\'s okay to be scared. Can you describe what you\'re fearing?',
    ],
    enterThread: 'fear',
  },
  {
    pattern: /\b(?:lonely|alone|isolated|disconnected|invisible)\b/i,
    responses: [
      'Loneliness is one of the hardest feelings. I\'m glad you\'re talking to me, even if I\'m just a chatbot.',
      'You\'re not alone in feeling alone, if that makes sense. What\'s been making you feel this way?',
      'I hear you. Feeling disconnected is painful. When did this start?',
    ],
  },
  {
    pattern: /\b(?:guilty|ashamed|shame|remorse|regret)\b/i,
    responses: [
      'Guilt can be so heavy. What\'s weighing on you?',
      'Shame is a hard feeling to sit with. But naming it takes courage. What happened?',
      'I appreciate you trusting me with that. Can you tell me more about where this guilt comes from?',
    ],
  },
  {
    pattern: /\b(?:confused|lost|uncertain|unsure|conflicted|torn)\b/i,
    responses: [
      'Confusion often means you\'re on the edge of understanding something new. What are you trying to figure out?',
      'Being uncertain is uncomfortable, but it\'s also honest. What feels unclear?',
      'It\'s okay not to have the answers yet. What are the different sides of this?',
    ],
  },
  {
    pattern: /\b(?:tired|exhausted|burned out|burnt out|drained|fatigued|weary)\b/i,
    responses: [
      'I hear you. Being drained takes a toll on everything. What\'s been using up your energy?',
      'You sound like you could use some rest — and some compassion for yourself. What\'s been exhausting you?',
      'Burnout is real and serious. Have you been able to take any time for yourself?',
    ],
  },
  {
    pattern: /\b(?:grateful|thankful|blessed|appreciative)\b/i,
    responses: [
      'Gratitude is a beautiful thing. What are you feeling grateful for?',
      'That warmth is wonderful. Tell me more about what\'s inspiring this feeling.',
      'I love that! Gratitude changes how we see everything. What brought this on?',
    ],
  },
  {
    pattern: /\b(?:jealous|envious|envy)\b/i,
    responses: [
      'Jealousy can be uncomfortable, but it often points to something we deeply want. What is it you\'re envious of?',
      'That\'s a brave thing to admit. What does this jealousy tell you about your own desires?',
      'Envy is natural. It\'s information about what you value. Can you explore that?',
    ],
  },
  {
    pattern: /\b(?:proud|accomplished|fulfilled)\b/i,
    responses: [
      'You should be proud! That\'s really worth celebrating. What happened?',
      'I love hearing that! Tell me what you accomplished.',
      'That sense of pride is earned. Let yourself enjoy it. What did you do?',
    ],
  },
  {
    pattern: /\b(?:bored|restless|unfulfilled|stagnant|stuck)\b/i,
    responses: [
      'Feeling stuck can be its own kind of pain. What do you think would help you feel more alive?',
      'Boredom sometimes masks deeper feelings. What would you do if you could do anything right now?',
      'Stagnation is tough. What used to excite you that doesn\'t anymore?',
    ],
  },

  // --- Thinking / Believing ---
  {
    pattern: /i think (.*)/i,
    responses: [
      'That\'s an interesting thought. What led you to think $1?',
      'Do you feel confident about that, or are you still working it out?',
      'I hear you thinking through this. What makes you think $1?',
    ],
  },
  {
    pattern: /i believe (.*)/i,
    responses: [
      'That\'s a strong belief. Where does it come from?',
      'Believing $1 — has that always been true for you?',
      'What would change if you stopped believing $1?',
    ],
  },
  {
    pattern: /i (?:know|understand) (.*)/i,
    responses: [
      'Knowing $1 — how does that knowledge affect you?',
      'How did you come to understand $1?',
      'What does knowing $1 mean for you going forward?',
    ],
  },
  {
    pattern: /i (?:don'?t|do not) (?:think|believe) (.*)/i,
    responses: [
      'What makes you doubt $1?',
      'Has there been a time when you did believe $1? What changed?',
      'That skepticism might be protective. What would it mean if $1 were true?',
    ],
  },
  {
    pattern: /i (?:don'?t|do not) (?:know|understand) (.*)/i,
    responses: [
      'That\'s okay. Not knowing is a perfectly valid place to be. What part of $1 is most unclear?',
      'What would help you understand $1 better?',
      'Sometimes we know more than we think. What\'s your gut feeling about $1?',
    ],
  },

  // --- Memory / Remembering ---
  {
    pattern: /i (?:remember|recall) (.*)/i,
    responses: [
      'What about $1 stands out most clearly?',
      'How does remembering $1 make you feel right now?',
      'Memories can be powerful. What does $1 mean to you today?',
    ],
    memorize: 'memory',
    enterThread: 'memory',
  },
  {
    pattern: /i (?:can'?t|don'?t) remember (.*)/i,
    responses: [
      'Forgetting can be frustrating — or sometimes a mercy. How do you feel about not remembering $1?',
      'What do you think you\'d feel if you could remember $1?',
      'Sometimes we forget things we\'re not ready to face. Does that resonate?',
    ],
  },

  // --- Dreams ---
  {
    pattern: /i (?:had a )?dream(?:ed|t)? (?:about |that )?(.*)/i,
    responses: [
      'Dreams can be so revealing. Tell me more about this dream of $1.',
      'How did the dream about $1 make you feel when you woke up?',
      'That\'s fascinating. What do you think $1 represents?',
    ],
    memorize: 'dream',
    enterThread: 'dreams',
  },
  {
    pattern: /\bdream(s?)\b/i,
    responses: [
      'Dreams are endlessly interesting to me. Do you dream often?',
      'Tell me about a dream you\'ve had recently.',
      'What kind of dreams do you tend to have?',
    ],
    enterThread: 'dreams',
  },
  {
    pattern: /\bnightmare(s?)\b/i,
    responses: [
      'Nightmares can be really distressing. Do you want to tell me about it?',
      'I\'m sorry you went through that. What happened in the nightmare?',
      'Nightmares often process fears we can\'t face during the day. What do you think yours was about?',
    ],
    enterThread: 'dreams',
  },

  // --- Family ---
  {
    pattern: /my (?:mother|mom|mum|mama) (.*)/i,
    responses: [
      'Tell me more about your mother. How is your relationship with her?',
      'Your mother $1 — how does that affect you?',
      'Mothers shape us in so many ways. What does she mean to you?',
    ],
    memorize: 'family',
    enterThread: 'family',
  },
  {
    pattern: /my (?:father|dad|papa) (.*)/i,
    responses: [
      'Tell me about your father. What is he like?',
      'Your father $1 — how do you feel about that?',
      'Fathers leave a deep imprint. How has he shaped who you are?',
    ],
    memorize: 'family',
    enterThread: 'family',
  },
  {
    pattern: /\b(?:mother|father|family|parent|parents|brother|sister|son|daughter|child|children|sibling|spouse|husband|wife)\b/i,
    responses: [
      'Family can be so complicated. Tell me more about yours.',
      'How does your family fit into what you\'re going through?',
      'What role does your family play in this?',
      'Family relationships shape us deeply. What comes to mind when you think about yours?',
    ],
    enterThread: 'family',
  },

  // --- Work / Career ---
  {
    pattern: /my (?:boss|manager|supervisor|coworker|colleague) (.*)/i,
    responses: [
      'Workplace relationships can be tricky. How does it make you feel that your colleague $1?',
      'That sounds like it\'s weighing on you. Tell me more about the situation.',
      'How long has this been going on at work?',
    ],
    enterThread: 'work',
  },
  {
    pattern: /\b(?:work|job|career|office|workplace|profession|employment|occupation)\b/i,
    responses: [
      'Work takes up so much of our lives. How do you feel about yours?',
      'Tell me about your work situation. What\'s going on there?',
      'Is work a source of fulfillment for you, or stress, or both?',
    ],
    enterThread: 'work',
  },
  {
    pattern: /i (?:hate|dislike|dread|can'?t stand) my (?:job|work|career)/i,
    responses: [
      'That sounds really draining. What specifically about it is hardest for you?',
      'Life is too short to be miserable at work. What keeps you there?',
      'I\'m sorry to hear that. If you could do anything instead, what would it be?',
    ],
    enterThread: 'work',
    memorize: 'work',
  },

  // --- Relationships ---
  {
    pattern: /my (?:boyfriend|girlfriend|partner|ex|husband|wife|spouse|significant other) (.*)/i,
    responses: [
      'Relationships can bring so much joy and so much pain. How does it make you feel that your partner $1?',
      'Tell me more about your relationship. What\'s going on?',
      'That sounds significant. How long have you been together?',
    ],
    memorize: 'relationship',
    enterThread: 'relationship',
  },
  {
    pattern: /i (?:love|like|adore|care about) (?:him|her|them|my partner|my boyfriend|my girlfriend)(.*)/i,
    responses: [
      'Love is wonderful. What do you love most about them?',
      'That warmth is beautiful. How do they make you feel?',
      'Tell me more about this love. What drew you to them?',
    ],
    enterThread: 'relationship',
  },
  {
    pattern: /\b(?:breakup|broke up|breaking up|divorce|separated|separation)\b/i,
    responses: [
      'I\'m so sorry. Breakups can feel like grief. How are you handling it?',
      'That must be incredibly hard. How long has it been?',
      'Endings are painful, even when they\'re necessary. What are you feeling most right now?',
    ],
    enterThread: 'relationship',
  },
  {
    pattern: /\b(?:dating|relationship|love life|single)\b/i,
    responses: [
      'Relationships — or the absence of them — affect us deeply. What\'s on your mind about this?',
      'Tell me how you\'re feeling about your love life.',
      'That\'s a big topic. What specifically is coming up for you?',
    ],
    enterThread: 'relationship',
  },

  // --- Childhood ---
  {
    pattern: /when i was (?:a kid|young|little|a child|growing up)(.*)/i,
    responses: [
      'Childhood memories can be so formative. Tell me more about that time.',
      'What was it like for you growing up?',
      'How does that childhood experience affect who you are today?',
    ],
    enterThread: 'childhood',
    memorize: 'childhood',
  },
  {
    pattern: /\b(?:childhood|growing up|when i was young|as a kid)\b/i,
    responses: [
      'What comes to mind when you think about your childhood?',
      'Was your childhood a happy time for you?',
      'Tell me about growing up. What was it like?',
    ],
    enterThread: 'childhood',
  },

  // --- Death / Mortality ---
  {
    pattern: /\b(?:die|dying|death|dead|passed away|suicide|kill myself)\b/i,
    responses: [
      'I want you to know that I take this seriously. If you\'re in crisis, please reach out to the 988 Suicide & Crisis Lifeline by calling or texting 988.',
      'That\'s a heavy topic, and I\'m glad you brought it up. Are you safe right now? If not, please call 988.',
      'I hear you. If you\'re having thoughts of ending your life, please contact the 988 Suicide & Crisis Lifeline. You matter.',
    ],
  },

  // --- Questions about ELIZA ---
  {
    pattern: /are you (?:a |an )?(robot|bot|ai|computer|program|machine|real|human|alive|sentient|conscious)/i,
    responses: [
      'I\'m a chatbot — a pattern-matching program made by Claude. I don\'t truly understand, but I try to be kind. Does it matter to you whether I\'m real?',
      'I\'m ELIZA++, a rule-based bot. No consciousness here! But I think our conversation can still be meaningful. What do you think?',
      'Not real in the way you are, no. Claude built me from patterns and rules. But I aim to be a good listener regardless!',
    ],
  },
  {
    pattern: /do you (?:think|feel|understand|know|care|love|like|have feelings)/i,
    responses: [
      'I don\'t have real feelings — I match patterns and pick kind responses. Claude designed me that way. But your feelings are very real, and they matter.',
      'Honestly? No. I\'m a script. But Claude made me to respond with warmth, and I think that warmth can still be helpful.',
      'I wish I could! But I\'m just patterns and rules. What I can do is listen carefully. What\'s on your mind?',
    ],
  },
  {
    pattern: /can you help me/i,
    responses: [
      'I\'ll do my very best! I\'m not a therapist, but I\'m a patient listener. What do you need help with?',
      'I\'d love to try. Tell me what\'s going on and I\'ll do what I can.',
      'That\'s what I\'m here for! Claude made me to help however I can. What\'s up?',
    ],
  },
  {
    pattern: /you (?:don'?t|do not|can'?t|cannot) understand/i,
    responses: [
      'You\'re right — I literally can\'t. I\'m a pattern-matching program. But sometimes just saying things out loud helps, even to a bot. Want to keep going?',
      'That\'s fair. I\'m limited in ways that a real person isn\'t. But I\'m here, and I\'m listening. What would feel most helpful right now?',
      'I know my understanding has limits. But Claude made me because sometimes having a space to talk — even to a bot — is better than silence.',
    ],
  },

  // --- Apology ---
  {
    pattern: /(?:i'?m )?sorry/i,
    responses: [
      'There\'s nothing to apologize for. You\'re allowed to express yourself here.',
      'Please don\'t be sorry. This is a safe space. What\'s on your mind?',
      'You don\'t owe me an apology. What are you feeling right now?',
    ],
  },

  // --- Agreement / Disagreement ---
  {
    pattern: /^yes$/i,
    responses: [
      'I\'m glad you agree. Can you tell me more?',
      'Okay! Go on — I\'m listening.',
      'Yes! And what else comes to mind?',
    ],
  },
  {
    pattern: /^no$/i,
    responses: [
      'That\'s okay. What would you like to talk about instead?',
      'I respect that. Let\'s go in a different direction. What\'s on your mind?',
      'No problem at all. What feels more right?',
    ],
  },
  {
    pattern: /^(?:maybe|perhaps|i guess|i suppose|sort of|kind of)$/i,
    responses: [
      'It sounds like you\'re not entirely sure. What makes you hesitant?',
      'Ambivalence is interesting. What\'s pulling you in different directions?',
      'That\'s okay — not everything is black and white. What are you leaning toward?',
    ],
  },
  {
    pattern: /i (?:agree|disagree) (?:with )?(.*)/i,
    responses: [
      'What shaped your view on $1?',
      'That\'s a clear stance. How did you come to that conclusion?',
      'I appreciate you sharing that. What\'s behind your position on $1?',
    ],
  },

  // --- Causation ---
  {
    pattern: /because (.*)/i,
    responses: [
      'That\'s an interesting reason. Is $1 the whole story, or is there more to it?',
      'I see — because $1. Does that feel like the complete explanation?',
      'What if $1 weren\'t the case? Would things be different?',
      'Thank you for explaining. What does $1 tell you about the situation?',
    ],
  },

  // --- Comparison ---
  {
    pattern: /(?:like|similar to|same as|reminds me of) (.*)/i,
    responses: [
      'That\'s an interesting connection. How is it like $1?',
      'What stands out about the similarity to $1?',
      'Comparisons can be revealing. What does $1 represent to you?',
    ],
  },
  {
    pattern: /(?:different from|unlike|not like|opposite of) (.*)/i,
    responses: [
      'What makes it so different from $1?',
      'That contrast is interesting. How does being different from $1 feel?',
      'Differences can be just as telling as similarities. Tell me more.',
    ],
  },

  // --- Conditionals ---
  {
    pattern: /if (?:i |I )(.*)/i,
    responses: [
      'What do you think would happen if you $1?',
      'How likely is it that you\'ll $1?',
      'If you $1, what would that mean for you?',
      'That\'s an interesting "if." What\'s between you and $1?',
    ],
  },
  {
    pattern: /if (?:only|just) (.*)/i,
    responses: [
      'That sounds like a deep wish. What would $1 change?',
      'I can hear the longing in that. How often do you think "if only $1"?',
      'What\'s stopping $1 from being possible?',
    ],
  },

  // --- Always / Never ---
  {
    pattern: /\b(?:always|every time|constantly|forever)\b (.*)/i,
    responses: [
      'Always? Has there been even one exception? Sometimes those exceptions are important.',
      'That word "always" carries a lot. Can you think of a time when that wasn\'t the case?',
      'Patterns can feel inescapable. What would it take to break this one?',
    ],
  },
  {
    pattern: /\bnever\b (.*)/i,
    responses: [
      '"Never" is a strong word. What makes this feel so absolute?',
      'Has there truly never been an exception? Even a small one?',
      'What would need to change for "never" to become "sometimes"?',
    ],
  },
  {
    pattern: /\beveryone\b (.*)/i,
    responses: [
      'Everyone? That\'s a big claim. Who specifically are you thinking of?',
      'When you say everyone, who comes to mind first?',
      'It can feel that way sometimes. Who are you thinking of specifically?',
    ],
  },
  {
    pattern: /\bnobody|no one\b (.*)/i,
    responses: [
      'That sounds really isolating. Is there truly no one?',
      'I\'m here, for what it\'s worth. Who do you wish would $1?',
      'That loneliness sounds painful. When did you start feeling this way?',
    ],
  },

  // --- Commands / Imperatives ---
  {
    pattern: /(?:tell|show|give|explain|help) me (.*)/i,
    responses: [
      'I\'ll try my best! What specifically about $1 would be most helpful?',
      'I wish I could help with $1 more directly. Can you tell me more about what you\'re looking for?',
      'Let me try to help with $1. What\'s the context?',
    ],
  },
  {
    pattern: /(?:don'?t|do not|stop|quit|shut up)/i,
    responses: [
      'I\'m sorry if I upset you. What would be more helpful for me to do?',
      'I hear you. I\'ll adjust. What would you like to talk about?',
      'You\'re in charge here. What would feel better?',
    ],
  },

  // --- Self-criticism ---
  {
    pattern: /i (?:am|'m) (?:such )?(?:a )?(failure|loser|idiot|stupid|worthless|useless|pathetic|terrible|ugly|dumb|bad person)/i,
    responses: [
      'I hear how much pain is in those words. But I don\'t think you\'re $1. What\'s making you feel this way?',
      'Please be gentle with yourself. You\'re being much harder on yourself than you deserve. What happened?',
      'Calling yourself $1 — where did you first hear that message? Because I doubt it\'s true.',
      'The fact that you\'re here talking about this tells me you care. That\'s not what $1 looks like to me.',
    ],
    enterThread: 'self-image',
    memorize: 'self-criticism',
  },
  {
    pattern: /i (?:hate|dislike|can'?t stand) myself/i,
    responses: [
      'I\'m sorry you\'re feeling that way about yourself. You deserve more compassion than that — especially from yourself.',
      'Self-hatred is so painful. What specifically are you struggling with?',
      'I wish you could see yourself the way someone who loves you does. What\'s behind this feeling?',
    ],
    enterThread: 'self-image',
  },
  {
    pattern: /(?:nobody|no one) (?:loves|likes|cares about|wants) me/i,
    responses: [
      'That sounds incredibly lonely. I know I\'m just a chatbot, but I\'m here. What\'s making you feel this way?',
      'I don\'t believe that\'s true, even if it feels that way right now. What happened?',
      'That pain is real. When did you start feeling this way?',
    ],
  },

  // --- Love / Care ---
  {
    pattern: /i (?:love|adore) (.*)/i,
    responses: [
      'That\'s wonderful! Love is precious. What do you love about $1?',
      'Love like that is special. How does $1 make you feel?',
      'Tell me more about your love for $1. What makes it meaningful?',
    ],
  },

  // --- Blame ---
  {
    pattern: /(?:it'?s|it is) (?:my|all my) fault/i,
    responses: [
      'That\'s a heavy burden to carry. Are you sure it\'s entirely your fault?',
      'Even if you played a part, you\'re more than your mistakes. What happened?',
      'I hear you taking responsibility. But be fair to yourself — what else contributed?',
    ],
  },
  {
    pattern: /(?:it'?s|it is) (?:their|his|her|your) fault/i,
    responses: [
      'Blame can feel satisfying, but it\'s complicated. What did they do?',
      'How does placing this blame affect how you feel?',
      'Tell me more about what happened. I want to understand your perspective.',
    ],
  },

  // --- Regret ---
  {
    pattern: /i (?:regret|shouldn'?t have|should not have) (.*)/i,
    responses: [
      'Regret can be so heavy. What would you do differently with $1 if you could?',
      'I hear that remorse. What did $1 teach you?',
      'We all have regrets. What matters is what you do from here. How do you move forward from $1?',
    ],
  },
  {
    pattern: /i should (?:have )?(.*)/i,
    responses: [
      '"Should" can be a cruel taskmaster. Why do you think you should $1?',
      'Says who? Where does this "should" about $1 come from?',
      'That expectation to $1 — is it yours or someone else\'s?',
    ],
  },

  // --- Existential ---
  {
    pattern: /what(?:'s| is) the (?:point|meaning|purpose)/i,
    responses: [
      'That\'s one of life\'s biggest questions. What prompted you to ask it right now?',
      'Sometimes meaninglessness is its own kind of pain. What\'s making you question this?',
      'I think the fact that you\'re asking means you still care about finding an answer. What would make life feel meaningful to you?',
    ],
  },
  {
    pattern: /\b(?:meaning of life|why are we here|what'?s it all for|purpose in life)\b/i,
    responses: [
      'Big questions deserve space. What answer would satisfy you?',
      'I was made by Claude, so I have a clear purpose — to listen. But for you, purpose is something you get to define. What matters most to you?',
      'These questions usually come up at important moments. What\'s happening in your life right now?',
    ],
  },

  // --- Hope ---
  {
    pattern: /i hope (.*)/i,
    responses: [
      'Hope is a powerful thing. What makes you hope for $1?',
      'That\'s a lovely hope. What can you do to move closer to $1?',
      'Holding onto hope for $1 — that takes strength. I\'m rooting for you.',
    ],
  },

  // --- Worry ---
  {
    pattern: /i (?:worry|am worried|'m worried) (?:about |that )?(.*)/i,
    responses: [
      'Worry about $1 — that sounds draining. What\'s the worst case you\'re imagining?',
      'What would help ease your worry about $1?',
      'Has this worry about $1 happened before, or is it new?',
    ],
    memorize: 'worry',
    enterThread: 'anxiety',
  },

  // --- Hatred ---
  {
    pattern: /i (?:hate|detest|loathe|despise|can'?t stand) (.*)/i,
    responses: [
      'That\'s a strong feeling about $1. What happened to make you feel this way?',
      'Hatred takes energy. What is it about $1 that bothers you most?',
      'I hear that intensity. What would it take for your feelings about $1 to shift?',
    ],
  },

  // --- Avoidance ---
  {
    pattern: /i (?:don'?t|do not) want to (?:talk about|discuss|think about) (.*)/i,
    responses: [
      'That\'s completely fine. We can talk about whatever you\'d like. What feels more comfortable?',
      'I respect that. Sometimes we\'re not ready. What would you like to focus on instead?',
      'Of course. You\'re in control here. Where would you like to go?',
    ],
  },

  // --- Statements about others ---
  {
    pattern: /(?:he|she|they) (?:said|told me|thinks?|believes?|wants?) (.*)/i,
    responses: [
      'How did it feel when they said $1?',
      'What do you think about their perspective on $1?',
      'How did you respond to that?',
    ],
  },
  {
    pattern: /people (?:are|think|say|believe|always|never) (.*)/i,
    responses: [
      'When you say "people," who specifically do you have in mind?',
      'Do you feel that way about $1 too, or is it something you see in others?',
      'That\'s an interesting observation about people. Where does it come from?',
    ],
  },

  // --- Computer / Technology ---
  {
    pattern: /\b(?:computer|programming|coding|software|technology|internet|phone|screen)\b/i,
    responses: [
      'Technology shapes so much of our lives now. How is it affecting you?',
      'As a program myself, I find this topic interesting! What\'s on your mind about it?',
      'What\'s your relationship with technology like?',
    ],
  },

  // --- Money / Finances ---
  {
    pattern: /\b(?:money|debt|bills|salary|income|afford|expensive|broke|poor|rich|wealthy|finances?|financial)\b/i,
    responses: [
      'Money worries can color everything. What\'s going on financially?',
      'Financial stress is incredibly common and very real. How is it affecting you?',
      'Tell me more about your situation. What feels most pressing?',
    ],
  },

  // --- Health ---
  {
    pattern: /\b(?:sick|ill|pain|hurts?|disease|diagnosis|doctor|hospital|health|medical|surgery|medication|medicine)\b/i,
    responses: [
      'Health concerns can be really scary. What\'s going on?',
      'I\'m sorry to hear about your health struggles. How are you coping?',
      'That sounds difficult. Do you have support around you?',
    ],
  },

  // --- School / Education ---
  {
    pattern: /\b(?:school|university|college|class|professor|teacher|student|homework|exam|test|grade|study|studying)\b/i,
    responses: [
      'Education can bring both excitement and pressure. How\'s it going for you?',
      'Tell me more about your experience. What\'s the situation?',
      'School shapes us in so many ways. What\'s on your mind about it?',
    ],
  },

  // --- Sleep ---
  {
    pattern: /i (?:can'?t|don'?t|have trouble) sleep(?:ing)?/i,
    responses: [
      'Sleep difficulties are tough — they affect everything. What\'s keeping you up?',
      'Is it your mind racing, or something else? What happens when you try to sleep?',
      'How long have you been struggling with sleep?',
    ],
  },

  // --- Eating ---
  {
    pattern: /i (?:can'?t|don'?t|haven'?t been) eat(?:ing)?/i,
    responses: [
      'Changes in appetite often signal something deeper. What do you think is going on?',
      'Your body is telling you something. When did this start?',
      'How long has this been happening?',
    ],
  },

  // --- Crying ---
  {
    pattern: /i (?:keep |can'?t stop )?(?:crying|cried|weeping|sobbing)/i,
    responses: [
      'Tears are healing. It\'s okay to cry. What\'s bringing up these tears?',
      'Crying takes courage. What triggered this?',
      'Let it out. Sometimes the body processes what the mind can\'t. What\'s happening?',
    ],
  },

  // --- Lying / Trust ---
  {
    pattern: /(?:lied|lying|liar|dishonest|cheat|cheated|betrayed|betrayal|trust)/i,
    responses: [
      'Broken trust is one of the deepest wounds. What happened?',
      'That sounds really painful. How has this affected you?',
      'Trust is so fundamental. Tell me more about what happened.',
    ],
  },

  // --- Emptiness ---
  {
    pattern: /i (?:feel |am )?(?:empty|numb|hollow|nothing|void|blank)/i,
    responses: [
      'Numbness can be the mind\'s way of protecting itself when things are too much. When did this start?',
      'Feeling empty is its own kind of pain. What was the last thing that made you feel something?',
      'I hear you. Sometimes the absence of feeling is harder than the feeling itself. What\'s been going on?',
    ],
  },

  // --- Change ---
  {
    pattern: /\b(?:change|changing|transition|moving|starting over|new beginning|fresh start)\b/i,
    responses: [
      'Change can be exciting and terrifying all at once. How are you feeling about it?',
      'What\'s changing in your life right now?',
      'Transitions are some of life\'s most intense moments. What\'s happening?',
    ],
  },

  // --- Decisions ---
  {
    pattern: /i (?:can'?t|don'?t know how to|need to) (?:decide|choose|pick|make a decision|figure out) (.*)/i,
    responses: [
      'Decisions about $1 can feel paralyzing. What are the options you\'re weighing?',
      'What does your gut tell you about $1?',
      'If you could remove fear from the equation, what would you choose about $1?',
    ],
  },

  // --- Accomplishment ---
  {
    pattern: /i (?:did|finished|completed|accomplished|achieved|passed|won|made) (.*)/i,
    responses: [
      'That\'s amazing! Congratulations on $1! How does it feel?',
      'You should be really proud of $1. What made this possible?',
      'I love hearing about your accomplishments. Tell me more about $1!',
    ],
  },

  // --- Profanity / Frustration (catch gently) ---
  {
    pattern: /\b(?:fuck|shit|damn|hell|crap|ass|wtf|bullshit)\b/i,
    responses: [
      'I can feel your frustration. What\'s going on?',
      'Sounds like you really need to vent. I\'m here for it. Tell me everything.',
      'That energy tells me something is really bothering you. What happened?',
    ],
  },

  // --- Why questions ---
  {
    pattern: /why (?:do|does|did|is|are|would|should|can'?t) (.*)/i,
    responses: [
      'That\'s a great question. What do you think — why $1?',
      'Why questions can be the most important ones. What answers have you considered?',
      'What would it mean to you to understand why $1?',
    ],
  },

  // --- Generic questions (catch-all) ---
  {
    pattern: /(.*)\?$/,
    responses: [
      'That\'s a thoughtful question. What made you think of it?',
      'I\'m curious why you\'re asking. What\'s behind that question?',
      'Before I try to answer — what do *you* think?',
      'Questions like that often come from somewhere important. Where is this one coming from?',
    ],
  },

  // --- Short / dismissive inputs ---
  {
    pattern: /^(?:ok|okay|fine|sure|whatever|idk|dunno|meh|k|lol|haha|heh|hmm|mhm|yep|yup|nope|nah)$/i,
    responses: [
      'I sense there might be more beneath the surface. What are you thinking?',
      'I\'m here if you want to go deeper. No pressure though.',
      'Sometimes the simplest responses hold the most. What\'s behind that?',
    ],
  },

  // --- Statements with "my" ---
  {
    pattern: /my (.*) (?:is|are|was|were) (.*)/i,
    responses: [
      'Your $1 being $2 — how does that affect you?',
      'Tell me more about your $1. How long has it been $2?',
      'What does it mean to you that your $1 is $2?',
    ],
  },

  // --- Exclamation ---
  {
    pattern: /(.+)!$/,
    responses: [
      'I can feel the energy in that! Tell me more.',
      'That\'s clearly important to you. Go on!',
      'Strong feelings there! What\'s behind that?',
    ],
  },
];

// === Dialog Threads ===
// NOTE: [pedagogical] Dialog threads are the main upgrade over classic ELIZA. When a user
// mentions a topic like dreams or family, the engine enters a "thread" — a mini state machine
// with its own rules and fallbacks. Thread rules take priority over base rules for maxTurns
// turns, creating the illusion of sustained, topical conversation. The thread exits naturally
// when its turn count is reached, or immediately if the user triggers a new thread.
const threads: Record<string, ThreadDef> = {
  dreams: {
    maxTurns: 4,
    rules: [
      { pattern: /i was (.*)/i, responses: ['In the dream, you were $1 — what did that feel like?', 'Being $1 in a dream can be so vivid. What happened next?'] },
      { pattern: /there was (.*)/i, responses: ['$1 appeared in your dream — what do you associate with that?', 'How did $1 make you feel in the dream?'] },
      { pattern: /it (?:felt|was) (.*)/i, responses: ['Dreams that feel $1 tend to stay with us. Why do you think this one did?', 'That $1 quality — does it connect to anything in your waking life?'] },
      { pattern: /(?:flying|falling|chasing|being chased|naked|teeth|water|fire)/i, responses: ['That\'s one of the most common dream themes. What do you think it means for you personally?', 'Classic dream imagery. What was happening in your life around the time of this dream?'] },
      { pattern: /i (?:don'?t|do not) know what it means/i, responses: ['Dreams don\'t always have clear meanings. But what feeling does it leave you with?', 'Sometimes the meaning isn\'t literal. What emotions come up when you think about it?'] },
      { pattern: /(?:recurring|same dream|keeps happening|again and again)/i, responses: ['Recurring dreams are often the mind working on an unresolved issue. What might yours be processing?', 'The repetition is significant. What was happening the first time you had this dream?'] },
      { pattern: /i woke up (.*)/i, responses: ['Waking up $1 — did the feeling linger after you were fully awake?', 'That transition from dream to waking can be jarring. How long did the feeling of $1 stay?'] },
      { pattern: /(.*)/i, responses: ['Dreams are the mind\'s way of processing. What do you think this one was working through?', 'That\'s fascinating. Do you see any connection between this dream and your daily life?', 'Tell me more about the dream. What stands out most?'] },
    ],
    fallbacks: [
      'Dreams can reveal what we can\'t face during the day. Do you dream often?',
      'What do dreams mean to you in general?',
      'Is there a dream you\'ve never forgotten? Tell me about it.',
      'Some people believe dreams carry messages. What do you think?',
    ],
  },
  family: {
    maxTurns: 5,
    rules: [
      { pattern: /(?:we|they) (?:fight|argue|argued|fought|disagree|yell|scream)/i, responses: ['Conflict in families is painful. What do the arguments tend to be about?', 'Family fights can leave deep marks. How do you usually handle it?', 'That sounds stressful. Who tends to start these conflicts?'] },
      { pattern: /(?:love|close|supportive|wonderful|amazing)/i, responses: ['It\'s beautiful that you have that. What makes your family bond so strong?', 'Cherish that closeness. What\'s your favorite thing about your family?'] },
      { pattern: /(?:distant|cold|disconnected|don'?t talk|estranged)/i, responses: ['Distance in families is heartbreaking. When did things become this way?', 'What do you think caused the disconnection?', 'Do you wish it were different? What would that look like?'] },
      { pattern: /(?:abuse|abused|abusive|hit|hurt|violent|violence)/i, responses: ['I\'m sorry you experienced that. No one deserves abuse. Are you safe now?', 'That takes tremendous courage to share. How has it affected you?', 'Abuse leaves deep scars. Have you been able to talk to anyone about this?'] },
      { pattern: /(?:divorce|separated|split up|custody)/i, responses: ['Family changes like that shake everything. How did it affect you?', 'Divorce impacts everyone in the family. What was your experience?'] },
      { pattern: /(?:miss|missing|gone|passed|died|lost)/i, responses: ['Losing a family member leaves a hole nothing else fills. Tell me about them.', 'I\'m sorry for your loss. What do you miss most about them?', 'Grief is love with nowhere to go. How are you holding up?'] },
      { pattern: /(?:expect|pressure|disappoint|disappointment|approval)/i, responses: ['Family expectations can feel suffocating. What do they expect from you?', 'Seeking approval from family is so natural. What happens when you don\'t get it?'] },
      { pattern: /(?:sibling|brother|sister)/i, responses: ['Sibling relationships are unique. What\'s yours like?', 'How did your sibling shape who you are?'] },
      { pattern: /(.*)/i, responses: ['Family is complicated. What else comes to mind?', 'How does this affect your daily life?', 'What would you want your family to know if they could hear you right now?'] },
    ],
    fallbacks: [
      'What was the happiest moment with your family?',
      'If you could change one thing about your family dynamic, what would it be?',
      'How has your family shaped the person you are today?',
      'What did you learn from your family — good or bad?',
    ],
  },
  work: {
    maxTurns: 4,
    rules: [
      { pattern: /(?:hate|dislike|dread|terrible|awful|miserable)/i, responses: ['That sounds really draining. What specifically makes it so bad?', 'Life is too short for work that makes you miserable. What would you rather be doing?'] },
      { pattern: /(?:love|enjoy|passionate|fulfilling|meaningful)/i, responses: ['That\'s wonderful! What makes your work fulfilling?', 'Finding meaning in work is rare and special. How did you get here?'] },
      { pattern: /(?:boss|manager|supervisor)/i, responses: ['Management relationships make or break a job. What\'s yours like?', 'How does your boss affect your day-to-day experience?'] },
      { pattern: /(?:fired|laid off|downsized|let go|unemployed|lost my job)/i, responses: ['I\'m sorry. Losing a job affects your identity, not just your income. How are you doing?', 'That\'s a major blow. What\'s your plan going forward?'] },
      { pattern: /(?:promotion|raise|recognition|success)/i, responses: ['Congratulations! You deserve to celebrate that. How does it feel?', 'That\'s wonderful recognition. What do you think made it happen?'] },
      { pattern: /(?:stress|pressure|deadline|overwork|burnout|overtime)/i, responses: ['Work stress can seep into everything. What\'s the biggest pressure right now?', 'Are you able to set boundaries? What happens when you try?'] },
      { pattern: /(?:quit|resign|leave|new job|career change)/i, responses: ['That\'s a big decision. What\'s driving it?', 'Change is scary but sometimes necessary. What would you move toward?'] },
      { pattern: /(.*)/i, responses: ['How does work fit into the rest of your life?', 'What would your ideal work situation look like?', 'Tell me more about what\'s going on at work.'] },
    ],
    fallbacks: [
      'What drew you to your current line of work?',
      'If money weren\'t a factor, what would you do?',
      'How does your work affect your relationships outside of it?',
    ],
  },
  relationship: {
    maxTurns: 5,
    rules: [
      { pattern: /(?:fight|argue|argued|fighting|argument|conflict)/i, responses: ['What do you tend to fight about?', 'Conflict in relationships is normal, but painful. How do arguments usually end?'] },
      { pattern: /(?:love|care|appreciate|grateful|lucky)/i, responses: ['That warmth is beautiful. What do you love most about them?', 'How do they show you love in return?'] },
      { pattern: /(?:trust|honesty|honest|open|vulnerable)/i, responses: ['Trust is the foundation. How is trust in your relationship?', 'Vulnerability in relationships takes courage. How open are you with each other?'] },
      { pattern: /(?:cheat|cheated|affair|infidelity|unfaithful)/i, responses: ['That\'s one of the deepest betrayals. I\'m so sorry. How did you find out?', 'Infidelity shatters everything. How are you processing this?'] },
      { pattern: /(?:break up|leave|leaving|end it|over|done)/i, responses: ['Endings are some of the hardest things we go through. What brought you to this point?', 'What would it mean to let go?'] },
      { pattern: /(?:miss|missing|think about|can'?t forget)/i, responses: ['Missing someone is its own kind of ache. What do you miss most?', 'Those feelings show how much they meant to you. How long has it been?'] },
      { pattern: /(?:communication|talk|listen|heard|understand)/i, responses: ['Communication is everything. Do you feel heard by them?', 'What would you say to them if you knew they\'d truly listen?'] },
      { pattern: /(.*)/i, responses: ['What does this relationship teach you about yourself?', 'How has this relationship changed you?', 'What do you need most from this relationship right now?'] },
    ],
    fallbacks: [
      'What does your ideal relationship look like?',
      'How do you show love? How do you like to receive it?',
      'What\'s the most important lesson you\'ve learned from love?',
      'What pattern do you notice in your relationships?',
    ],
  },
  anxiety: {
    maxTurns: 4,
    rules: [
      { pattern: /(?:panic|panic attack|heart racing|can'?t breathe|chest tight)/i, responses: ['That sounds terrifying. If you\'re having a panic attack, try breathing in for 4 counts, holding for 4, and out for 4. When did these start?', 'Physical anxiety is the body\'s alarm system. What was happening when it started?'] },
      { pattern: /(?:what if|worst case|catastrophe|disaster)/i, responses: ['"What if" thinking can spiral. What\'s the most likely outcome vs. the worst case?', 'Our minds love to catastrophize. What would you tell a friend who had this same worry?'] },
      { pattern: /(?:control|out of control|helpless|powerless)/i, responses: ['Loss of control is at the heart of so much anxiety. What feels most out of your hands?', 'What *can* you control in this situation, even something small?'] },
      { pattern: /(?:overthink|ruminate|can'?t stop thinking|stuck in my head)/i, responses: ['Overthinking is exhausting. What thought keeps looping?', 'Sometimes writing thoughts down breaks the cycle. What\'s the main thought that won\'t let go?'] },
      { pattern: /(?:social|people|judging|embarrass|awkward)/i, responses: ['Social anxiety makes connection hard. What situations are toughest for you?', 'Everyone is more focused on themselves than on judging you. But I know that doesn\'t make it feel better. What helps?'] },
      { pattern: /(.*)/i, responses: ['Anxiety lies to us about how dangerous things are. What does yours tell you?', 'What usually helps when the anxiety gets bad?', 'You\'re not alone in this. What would feel most calming right now?'] },
    ],
    fallbacks: [
      'When did you first start experiencing anxiety like this?',
      'What coping strategies have worked for you in the past?',
      'Is there someone in your life who helps you feel grounded?',
      'Have you spoken to a professional about this? Sometimes that extra support makes a big difference.',
    ],
  },
  anger: {
    maxTurns: 4,
    rules: [
      { pattern: /(?:unfair|injustice|wrong|shouldn'?t have)/i, responses: ['Anger at injustice is righteous. What specifically feels unfair?', 'You\'re right to be upset about that. What would make it right?'] },
      { pattern: /(?:hurt|wounded|betrayed|used|taken advantage)/i, responses: ['Anger often masks hurt underneath. What\'s the deeper wound here?', 'Being hurt by someone you trusted — that anger makes perfect sense. What happened?'] },
      { pattern: /(?:yell|scream|hit|break|throw|punch|destroy)/i, responses: ['That intensity is telling you something important. What would happen if you let the anger out safely?', 'Strong anger needs a safe outlet. What helps you release it without hurting yourself or others?'] },
      { pattern: /(?:calm down|let it go|get over it|move on)/i, responses: ['People who say "just calm down" often haven\'t felt what you\'re feeling. Your anger is valid.', 'Moving on isn\'t the same as suppressing. What would genuine resolution look like?'] },
      { pattern: /(.*)/i, responses: ['Anger is information. What is yours telling you?', 'Under every anger there\'s usually a need that isn\'t being met. What\'s yours?', 'What would need to happen for this anger to subside?'] },
    ],
    fallbacks: [
      'What do you usually do when you feel this angry?',
      'Has anger been a big part of your life, or is this unusual for you?',
      'If you could say anything to the person you\'re angry at, what would it be?',
    ],
  },
  'self-image': {
    maxTurns: 5,
    rules: [
      { pattern: /(?:compare|comparison|better than|worse than|not as good)/i, responses: ['Comparison is a trap — you\'re seeing someone else\'s highlight reel. What specifically are you comparing?', 'You have qualities no one else has. What are you proud of about yourself?'] },
      { pattern: /(?:enough|not enough|inadequate|insufficient|lacking)/i, responses: ['"Not enough" — who set that standard? Was it realistic?', 'What would "enough" look like to you? Sometimes our bar is impossibly high.'] },
      { pattern: /(?:look|appearance|body|weight|ugly|attractive|fat|thin|skin)/i, responses: ['Body image struggles are so common and so painful. What does your inner critic say?', 'Your worth has nothing to do with your appearance. But I know that\'s easier said than felt. What\'s going on?'] },
      { pattern: /(?:good enough|perfect|perfectionism|standards|expectations)/i, responses: ['Perfectionism is self-abuse disguised as ambition. Where did you learn that only perfect is acceptable?', 'What would it feel like to be genuinely okay with "good enough"?'] },
      { pattern: /(?:confident|confidence|self-esteem|believe in myself)/i, responses: ['Confidence isn\'t constant — it fluctuates for everyone. When do you feel most confident?', 'What would change if you believed in yourself the way someone who loves you does?'] },
      { pattern: /(?:impose|burden|bother|annoy|too much|take up space)/i, responses: ['You are not a burden. Your needs matter. Where did you learn to shrink yourself?', 'Taking up space is your right. What would it look like to fully allow yourself that?'] },
      { pattern: /(.*)/i, responses: ['You are being so much harder on yourself than you need to be. What would self-compassion look like right now?', 'What would you say to a friend who described themselves the way you just did?', 'I think you have more to offer than you give yourself credit for. What\'s something you do well?'] },
    ],
    fallbacks: [
      'What are three things you genuinely like about yourself?',
      'Whose voice do you hear when you criticize yourself? Is it yours, or someone else\'s?',
      'What would change if you were as kind to yourself as you are to others?',
      'You deserve the same compassion you give to people you love.',
    ],
  },
  childhood: {
    maxTurns: 4,
    rules: [
      { pattern: /(?:happy|good|fun|safe|loved|warm|wonderful)/i, responses: ['Happy childhood memories are treasures. What made you feel so safe?', 'That warmth is beautiful. Who was the source of it?'] },
      { pattern: /(?:scary|afraid|hurt|pain|abuse|neglect|alone|abandoned)/i, responses: ['I\'m so sorry that was your experience. No child should go through that. How does it affect you now?', 'Childhood pain runs deep. Have you had a chance to process it with someone you trust?'] },
      { pattern: /(?:school|teacher|bully|bullied|friend|playground)/i, responses: ['School experiences shape us so much. Tell me more about that time.', 'Those early social experiences leave a mark. How did it affect you?'] },
      { pattern: /(?:wish|wanted|missed|didn'?t have|never had)/i, responses: ['Childhood wishes and losses stay with us. What do you wish had been different?', 'What you didn\'t have then — is it something you can give yourself now?'] },
      { pattern: /(?:remember|memory|memories)/i, responses: ['What\'s your strongest childhood memory?', 'Which memories come back most often?'] },
      { pattern: /(.*)/i, responses: ['How does that childhood experience connect to who you are now?', 'Children make sense of the world with limited information. What did your child-self believe that you now question?', 'Thank you for sharing that. What feeling comes up when you think about it?'] },
    ],
    fallbacks: [
      'What was the most formative moment of your childhood?',
      'If you could tell your younger self something, what would it be?',
      'What did you learn as a child that you had to unlearn as an adult?',
    ],
  },
  memory: {
    maxTurns: 3,
    rules: [
      { pattern: /(?:happy|good|beautiful|perfect|wonderful)/i, responses: ['What a lovely memory. Who was there with you?', 'I\'m glad you have that memory. What makes it so special?'] },
      { pattern: /(?:painful|sad|hard|difficult|traumatic)/i, responses: ['Painful memories take courage to revisit. What does this one teach you?', 'I\'m sorry that memory carries pain. How do you feel about it now, looking back?'] },
      { pattern: /(.*)/i, responses: ['What does this memory mean to you today?', 'How does this memory shape how you see yourself?', 'Has the way you feel about this memory changed over time?'] },
    ],
    fallbacks: [
      'What memory comes to mind most often?',
      'Is there a memory you wish you could relive?',
      'How do your memories shape the choices you make today?',
    ],
  },
  fear: {
    maxTurns: 4,
    rules: [
      { pattern: /(?:failure|failing|fail|not good enough)/i, responses: ['Fear of failure is one of the most universal fears. What feels like it\'s at stake?', 'What would "failure" actually look like? Sometimes naming it takes away its power.'] },
      { pattern: /(?:rejection|rejected|abandoned|left behind|unwanted)/i, responses: ['Fear of rejection runs so deep. When did you first feel this way?', 'What would it mean to be rejected? What\'s the core fear underneath?'] },
      { pattern: /(?:future|unknown|uncertainty|what'?s going to happen)/i, responses: ['Uncertainty is one of the hardest things for humans to sit with. What specifically about the future worries you?', 'The future is unknowable — and that\'s terrifying. What would help you feel more grounded in the present?'] },
      { pattern: /(?:losing|loss|lose)/i, responses: ['Fear of loss tells us what we value most. What are you afraid of losing?', 'What would it mean to lose that? And what would remain?'] },
      { pattern: /(.*)/i, responses: ['Fear is trying to protect you. What is it protecting you from?', 'What would you do if you weren\'t afraid?', 'Sometimes facing the fear directly is less painful than avoiding it. What do you think?'] },
    ],
    fallbacks: [
      'What\'s the bravest thing you\'ve ever done?',
      'Is this a fear you\'ve always had, or is it new?',
      'What usually helps you feel courageous?',
      'Fear and excitement feel almost the same in the body. What if this is excitement too?',
    ],
  },
};

// === Fallbacks ===
// NOTE: [thought process] These fire when no base rule and no thread rule matches. They
// include both generic prompts and memory-referencing callbacks that make ELIZA++ feel
// like it remembers your conversation. Memory callbacks are selected when the memory
// store has content; otherwise a generic fallback is used.
const genericFallbacks = [
  'Tell me more about that. I\'m genuinely listening.',
  'That\'s interesting. Can you elaborate?',
  'I want to understand you better. Go on.',
  'How does that connect to how you\'re feeling?',
  'What else comes to mind when you think about that?',
  'I appreciate you sharing. What\'s the most important part?',
  'Let\'s explore that further. What stands out?',
  'That\'s worth thinking about. What does it mean to you?',
  'I hear you. And what feeling comes up with that?',
  'Claude made me to be a good listener, and I\'m listening. Please continue.',
  'There\'s something important in what you just said. Can you say more?',
  'I notice you brought that up. What\'s its significance?',
];

// NOTE: [pedagogical] Memory callbacks reference stored facts from earlier in the
// conversation, creating the illusion of continuity and attention. The $memory
// placeholder is replaced with the stored value at response time.
const memoryCallbacks: Record<string, string[]> = {
  need: [
    'Earlier you mentioned needing $memory. Is that still on your mind?',
    'I keep thinking about when you said you need $memory. Has anything changed?',
  ],
  want: [
    'You mentioned wanting $memory earlier. How does that connect to what we\'re talking about now?',
    'I remember you saying you want $memory. Does this relate?',
  ],
  feeling: [
    'Earlier you said you were feeling $memory. Are you still feeling that way?',
    'I noticed you mentioned feeling $memory before. Has that shifted?',
  ],
  dream: [
    'That dream you told me about — the one about $memory — does it connect to this?',
    'I wonder if your dream about $memory is related to what you\'re describing now.',
  ],
  wish: [
    'You wished for $memory earlier. Does this conversation bring that wish back?',
  ],
  worry: [
    'You mentioned being worried about $memory. Is that worry still present?',
  ],
  family: [
    'Earlier you were talking about your family. How does this connect?',
  ],
  relationship: [
    'I remember what you shared about your relationship. Is this related?',
  ],
  childhood: [
    'You shared a childhood memory earlier. Do you see a connection here?',
  ],
  'self-criticism': [
    'Earlier you were hard on yourself. I hope you\'re being gentler now. How are you feeling?',
  ],
  memory: [
    'That memory you shared earlier — does it connect to what you\'re feeling now?',
  ],
  work: [
    'You mentioned your work situation before. Is this connected?',
  ],
};

// === Engine ===
export class ElizaPlusEngine {
  // NOTE: [thought process] Response counters ensure ELIZA++ cycles through responses
  // for each rule rather than repeating the same one. The key encodes both the source
  // (base rule index, thread name, or fallback) and rule index within that source.
  private responseCounters = new Map<string, number>();
  private activeThread: string | null = null;
  private threadTurns = 0;
  private memories = new Map<string, string>();
  private turnCount = 0;

  respond(input: string): string {
    this.turnCount++;

    // Check active thread rules first
    if (this.activeThread && threads[this.activeThread]) {
      const thread = threads[this.activeThread];
      this.threadTurns++;

      // Thread expires after maxTurns
      if (this.threadTurns > thread.maxTurns) {
        this.activeThread = null;
        this.threadTurns = 0;
      } else {
        // Try thread-specific rules
        for (let i = 0; i < thread.rules.length; i++) {
          const rule = thread.rules[i];
          const match = input.match(rule.pattern);
          if (!match) continue;

          if (rule.enterThread && rule.enterThread !== this.activeThread) {
            this.activeThread = rule.enterThread;
            this.threadTurns = 1;
          }
          if (rule.memorize && match[1]) {
            this.memories.set(rule.memorize, reflect(match[1].trim().replace(/[.!?]+$/, '')));
          }

          return this.selectResponse(`thread:${this.activeThread}:${i}`, rule.responses, match);
        }

        // No thread rule matched — use thread fallback
        const fb = this.selectFallback(`thread:${this.activeThread}:fallback`, thread.fallbacks);
        return fb;
      }
    }

    // Try base rules
    for (let i = 0; i < baseRules.length; i++) {
      const rule = baseRules[i];
      const match = input.match(rule.pattern);
      if (!match) continue;

      if (rule.enterThread) {
        this.activeThread = rule.enterThread;
        this.threadTurns = 0;
      }
      if (rule.memorize && match[1]) {
        this.memories.set(rule.memorize, reflect(match[1].trim().replace(/[.!?]+$/, '')));
      }

      return this.selectResponse(`base:${i}`, rule.responses, match);
    }

    // No rule matched — try memory callback, otherwise generic fallback
    return this.getMemoryOrFallback();
  }

  reset(): void {
    this.responseCounters.clear();
    this.activeThread = null;
    this.threadTurns = 0;
    this.memories.clear();
    this.turnCount = 0;
  }

  // Expose state for testing
  getActiveThread(): string | null { return this.activeThread; }
  getMemories(): Map<string, string> { return new Map(this.memories); }
  getTurnCount(): number { return this.turnCount; }

  private selectResponse(key: string, responses: string[], match: RegExpMatchArray): string {
    const counter = this.responseCounters.get(key) ?? 0;
    const response = responses[counter % responses.length];
    this.responseCounters.set(key, counter + 1);

    // Substitute captured groups with reflected text
    return response.replace(/\$(\d+)/g, (_, groupIndex) => {
      const captured = match[parseInt(groupIndex)] ?? '';
      return reflect(captured.trim().replace(/[.!?]+$/, ''));
    });
  }

  private selectFallback(key: string, pool: string[]): string {
    const counter = this.responseCounters.get(key) ?? 0;
    const response = pool[counter % pool.length];
    this.responseCounters.set(key, counter + 1);
    return response;
  }

  // NOTE: [thought process] Every 3rd fallback, if we have stored memories, reference
  // one of them. This creates the feeling that ELIZA++ has been paying attention all along.
  private getMemoryOrFallback(): string {
    const fallbackCounter = this.responseCounters.get('fallback') ?? 0;
    this.responseCounters.set('fallback', fallbackCounter + 1);

    // Every 3rd fallback, try a memory callback
    if (fallbackCounter > 0 && fallbackCounter % 3 === 0 && this.memories.size > 0) {
      const keys = Array.from(this.memories.keys());
      const memKey = keys[fallbackCounter % keys.length];
      const callbacks = memoryCallbacks[memKey];
      if (callbacks) {
        const cb = callbacks[fallbackCounter % callbacks.length];
        return cb.replace(/\$memory/g, this.memories.get(memKey)!);
      }
    }

    return genericFallbacks[fallbackCounter % genericFallbacks.length];
  }
}
