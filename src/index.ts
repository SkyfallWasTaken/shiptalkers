import "dotenv/config";
import { z } from "zod";
import { createCanvas, loadImage } from "canvas";
import {
  fetchMemberAnalyticsData,
  getUserProfile,
  getUserProfileSections,
} from "./slackApi";

export const Env = z.object({
  WORKSPACE: z.string(),
  TEAM_ID: z.string().length(9),
  XOXC: z.string(),
  XOXD: z.string(),
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
  num_found: z.number().min(1).max(1),
  member_activity: z.array(MemberActivity).min(1),
});

const username = "mahadkalam1234"; // FIXME: change
const slackMember = await fetchMemberAnalyticsData(
  username,
  env.XOXC,
  env.XOXD,
  env.WORKSPACE
);
const slackProfile = await getUserProfile(
  slackMember.user_id,
  env.XOXC,
  env.XOXD
);
const slackProfileSections = await getUserProfileSections(
  slackMember.user_id,
  env.XOXC,
  env.XOXD
);
const githubUrl = slackProfileSections
  .flatMap((section) => section.profileElements)
  .find((element) => element?.uri?.includes("github.com"))?.uri;
const avatarUrl = slackProfile.image_original;
if (!githubUrl) throw new Error("No github url found");
if (!avatarUrl) throw new Error("No avatar url found");

console.log(avatarUrl, githubUrl);
