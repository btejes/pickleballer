// Quiz funnel tracking.
//
// The admin's Events page already lists completions and which paddles
// were clicked, so we know what finishers do. What nobody can see is
// how many people start and where the rest go. 1,059 completions tells
// you nothing about whether that is most of the people who began or a
// tenth of them, and Ben is buying this traffic.
//
// So these events exist to answer one question: of the people who open
// the quiz, where do we lose them. Everything is keyed by question id,
// which is what turns "people drop off" into "people drop off on q4".
//
// The quiz runs in an iframe from GitHub Pages inside bepickleballer.com,
// so this is its own PostHog context, separate from anything on the
// parent page. That is fine for a funnel, which only has to be
// consistent within one visit.

// PostHog itself is loaded and configured by the snippet in index.html,
// verbatim as PostHog publishes it. Deliberately not inlined here and
// hand-trimmed: I did that first and dropped part of it, which left
// window.posthog as a stub whose capture() silently did nothing. Every
// event looked fine in the code and none of them existed.
//
// So this module only wraps what the snippet created, and says plainly
// when that is missing.

export function initAnalytics() {
  // Nothing to do: the snippet runs before this module. Kept as a call
  // site so the quiz reads as switching analytics on deliberately.
  if (!window.posthog || typeof window.posthog.capture !== 'function') {
    console.warn('[bp-quiz] PostHog not loaded, funnel events will not be sent');
  }
}

function capture(event, props) {
  if (!window.posthog || typeof window.posthog.capture !== 'function') return;
  try {
    window.posthog.capture(event, props || {});
  } catch (err) {
    // Analytics must never be why the quiz stops working.
  }
}

export function trackQuizStarted(totalQuestions) {
  capture('quiz_started', { total_questions: totalQuestions });
}

// The one that answers Ben's question. Fired on arrival at each
// question rather than on answering it, because arrival is what makes a
// funnel readable: somebody who reaches q4 and never reaches q5 left on
// q4, and no amount of counting answers says that as plainly.
export function trackQuestionViewed(questionId, index, total) {
  capture('quiz_question_viewed', {
    question_id: questionId,
    question_number: index + 1,
    total_questions: total,
  });
}

export function trackQuizSubmitted(completionId) {
  capture('quiz_submitted', { completion_id: completionId || null });
}

// The email gate is its own step and deserves its own numbers. It sits
// between finishing the quiz and seeing the results, so it is the one
// place somebody can do all the work and still leave with nothing.
export function trackEmailGateViewed(completionId) {
  capture('quiz_email_gate_viewed', { completion_id: completionId || null });
}

export function trackEmailGiven(completionId) {
  capture('quiz_email_given', { completion_id: completionId || null });
}

export function trackEmailSkipped(completionId) {
  capture('quiz_email_skipped', { completion_id: completionId || null });
}

export function trackResultsViewed(completionId, paddleCount) {
  capture('quiz_results_viewed', {
    completion_id: completionId || null,
    paddle_count: paddleCount,
  });
}

// Already recorded in Sheets by track_click. Here too so the whole
// funnel reads in one place, rather than five steps in PostHog and the
// last one somewhere else.
export function trackPaddleClicked(completionId, paddleId, paddleName) {
  capture('quiz_paddle_clicked', {
    completion_id: completionId || null,
    paddle_id: paddleId,
    paddle_name: paddleName,
  });
}
