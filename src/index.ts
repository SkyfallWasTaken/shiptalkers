import "dotenv/config";
import { z } from "zod";
import { createCanvas, loadImage } from "canvas";

export const Env = z.object({
  WORKSPACE: z.string(),
  TEAM_ID: z.string().length(9),
  C_TOKEN: z.string(),
  D_TOKEN: z.string(),
});
const env = Env.parse(process.env);
env.D_TOKEN = decodeURIComponent(env.D_TOKEN);

export const MemberActivity = z.object({
  username: z.string(),
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
const formData = new FormData();
formData.append("token", env.C_TOKEN);
formData.append("date_range", "30d");
formData.append("count", "1");
formData.append("sort_column", "username");
formData.append("sort_direction", "asc");
formData.append("query", username);
formData.append("count", "1");

const dbg = (...args: any[]) => {
  console.debug(...args);
  return args.length === 1 ? args[0] : args;
};
const response = await fetch(
  `https://${env.WORKSPACE}.slack.com/api/admin.analytics.getMemberAnalytics`,
  {
    method: "POST",
    body: formData,
    headers: {
      Authority: `${env.WORKSPACE}.slack.com`,
      Cookie: `d=${encodeURIComponent(env.D_TOKEN)}`, // We don't really need anything fancy here.
    },
  }
);
const data = AnalyticsResult.parse(dbg(await response.json()));
if (!data.ok) {
  throw new Error("Failed to fetch analytics data");
}
const member = data.member_activity[0];
if (member.username !== username) {
  throw new Error(`${member.username} != ${username}`);
}
