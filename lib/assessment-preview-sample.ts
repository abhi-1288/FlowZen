import { buildServedAssessmentPaper } from "@/lib/assessment-paper";

/**
 * Placeholder paper for the HR "Preview as Candidate" dry run.
 *
 * Walking the whole flow is the point of the preview, so a job whose question
 * bank is still empty (or whose chosen slice serves nothing) gets these generic
 * questions instead of a dead end. They keep every shape real — four options, a
 * correct index, marks — so start, the countdown, the required-question check,
 * `computeAssessmentScore` and the answer key all run the exact code they will
 * run for candidates.
 *
 * Every response built on them carries `sample: true` so the UI can say out
 * loud, at every screen where they appear, that these are NOT this job's
 * questions. Deliberately boring and job-agnostic: nothing here should ever
 * look like content a real candidate will be asked.
 */

const SAMPLE_QUESTIONS: Array<{
  text: string;
  options: string[];
  correctIndex: number;
  type: "mcq";
  marks: number;
  required: boolean;
}> = [
  {
    text: "[Sample question] Which of these best describes a resume summary?",
    options: [
      "A one-to-two line pitch of your most relevant experience",
      "A full list of every job you have ever held",
      "The font and formatting choices in your resume",
      "A cover letter addressed to a specific recruiter",
    ],
    correctIndex: 0,
    type: "mcq",
    marks: 1,
    required: false,
  },
  {
    text: "[Sample question] A deadline is tomorrow and a task is only half done. What is the best first step?",
    options: [
      "Wait until the last hour and submit whatever exists",
      "Flag the risk early with an updated estimate and prioritise the critical parts",
      "Silently drop the task from your plan",
      "Hand it over without context",
    ],
    correctIndex: 1,
    type: "mcq",
    marks: 1,
    required: false,
  },
  {
    text: "[Sample question] What does double-checking your work usually mean?",
    options: [
      "Asking someone else to do it for you",
      "Reviewing the output against the requirement before submitting",
      "Doing the same task twice from scratch",
      "Waiting a week before looking at it again",
    ],
    correctIndex: 1,
    type: "mcq",
    marks: 1,
    required: false,
  },
  {
    text: "[Sample question] You notice an error in a colleague's report an hour before it is due. You would:",
    options: [
      "Say nothing; it is their report",
      "Point it out immediately, naming the specific line that looks wrong",
      "Fix it silently after it is sent",
      "Escalate to their manager first",
    ],
    correctIndex: 1,
    type: "mcq",
    marks: 1,
    required: false,
  },
  {
    text: "[Sample question] Which is the clearest way to start a status update?",
    options: [
      "A long description of everything you did",
      "The current state first, then blockers and next steps",
      "An apology for the delay",
      "A question for the reader",
    ],
    correctIndex: 1,
    type: "mcq",
    marks: 1,
    required: false,
  },
  {
    text: "[Sample question] 'On time, on budget, in scope' is an example of:",
    options: [
      "A common project trade-off triangle",
      "A legal contract clause",
      "A performance review template",
      "An attendance policy",
    ],
    correctIndex: 0,
    type: "mcq",
    marks: 1,
    required: false,
  },
];

/**
 * The sample paper in exactly the `{ served, key }` shape the preview start and
 * grade endpoints return for a real one, so both callers treat the fallback as
 * an ordinary paper with no special cases beyond the `sample` flag.
 */
export function buildPreviewSamplePaper() {
  return buildServedAssessmentPaper(SAMPLE_QUESTIONS as any[], [], null);
}
