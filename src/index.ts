import "dotenv/config";
import { z } from "zod";
import {
  fetchMemberAnalyticsData,
  getUserProfile,
  getUserProfileSections,
} from "./slackApi";
import { flattenObject } from "./util";
import type { FinalData } from "./image";
import generateImage from "./image";
import { writeFile } from "fs/promises";

export const Env = z.object({
  WORKSPACE: z.string(),
  TEAM_ID: z.string().length(9),
  XOXC: z.string().startsWith("xoxc-", "XOXC is invalid"),
  XOXD: z.string().startsWith("xoxd-", "XOXD is invalid"),
  WAKATIME_STATS_ENDPOINT: z.string().url().includes(":id").includes(":range"),
});
const env = Env.parse(process.env);
env.XOXD = decodeURIComponent(env.XOXD);

export const MemberActivity = z.object({
  username: z.string(),
  user_id: z.string(),
  display_name: z.string(),
  date_last_active: z.number().nonnegative(),
  messages_posted: z.number().nonnegative(),
  reactions_added: z.number().nonnegative(),
  days_active: z.number().nonnegative(),
  days_active_desktop: z.number().nonnegative(),
  days_active_android: z.number().nonnegative(),
  days_active_ios: z.number().nonnegative(),
  slack_huddles_count: z.number().nonnegative(),
});
export const AnalyticsResult = z.object({
  ok: z.boolean(),
  num_found: z.number().min(1),
  member_activity: z.array(MemberActivity).min(1),
});

const username = "mahadkalam1234"; // FIXME: change
const slackAnalytics = await fetchMemberAnalyticsData(
  username,
  env.XOXC,
  env.XOXD,
  env.WORKSPACE
);
const slackProfile = await getUserProfile(
  slackAnalytics.user_id,
  env.XOXC,
  env.XOXD
);
const slackProfileSections = await getUserProfileSections(
  slackAnalytics.user_id,
  env.XOXC,
  env.XOXD
);

const rawGithubUrl = slackProfileSections
  .flatMap((section) => section.profileElements)
  .find((element) => element?.uri?.includes("github.com"))?.uri;
const avatarUrl = slackProfile.image_original;
if (!rawGithubUrl) throw new Error("No github url found");
if (!avatarUrl) throw new Error("No avatar url found");
const githubUrl = new URL(rawGithubUrl);
const githubUsername = githubUrl.pathname.split("/")[1];

const wakaResponse = await fetch(
  env.WAKATIME_STATS_ENDPOINT.replace(":id", slackAnalytics.user_id).replace(
    ":range",
    "last_30_days"
  )
);
if (!wakaResponse.ok)
  throw new Error(`Status code != 200, it was ${wakaResponse.status}`);
const waka = await wakaResponse.json();
const codingTimeSeconds: number = waka.data.total_seconds;
const slackTimeEstimateSecs = Math.floor(
  slackAnalytics.messages_posted * 30 +
    slackAnalytics.slack_huddles_count * 30 * 60 +
    slackAnalytics.reactions_added * 5 +
    slackAnalytics.days_active_desktop * 60 * 20 +
    (slackAnalytics.days_active_android + slackAnalytics.days_active_ios) *
      60 *
      10
);

// Work out the percentage of more time spent on slack
const percentage = Math.floor(
  (slackTimeEstimateSecs / codingTimeSeconds) * 100
);

const overallProfile: FinalData = {
  avatarUrl,
  slack: {
    displayName: slackAnalytics.display_name,
    username: slackAnalytics.username,
  },
  github: {
    username: githubUsername,
    url: rawGithubUrl,
  },
  codingTimeSeconds,
  slackTimeEstimate: {
    seconds: slackTimeEstimateSecs,
    percentage,
  },
};

console.table(flattenObject(overallProfile));
await writeFile("output.svg", await generateImage(overallProfile));
