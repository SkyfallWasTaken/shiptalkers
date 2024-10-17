import "dotenv/config";
import { z } from "zod";
import cookie from "cookie";

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
  date_last_active: z.number().positive(),
  messages_posted: z.number().positive(),
  reactions_added: z.number().positive(),
  days_active: z.number().positive(),
  days_active_desktop: z.number().positive(),
  days_active_android: z.number().positive(),
  days_active_ios: z.number().positive(),
  slack_huddles_count: z.number(),
});
export const AnalyticsResult = z.object({
  ok: z.boolean(),
  num_found: z.number().min(1),
  member_activity: z.array(MemberActivity).min(1),
});

const formData = new FormData();
formData.append("token", env.C_TOKEN);
formData.append("date_range", "30d");
formData.append("count", "1");
formData.append("sort_column", "username");
formData.append("sort_direction", "asc");
formData.append("query", "mahadkalam1234"); // FIXME: change
formData.append("_x_reason", "loadMembersDataForTimeRange");

const response = await fetch(
  `https://${env.WORKSPACE}.slack.com/api/admin.analytics.getMemberAnalytics`,
  {
    method: "POST",
    body: formData,
    headers: {
      Authority: `${env.WORKSPACE}.slack.com`,
      Cookie: cookie.serialize("d", env.D_TOKEN),
    },
  }
);
const data = AnalyticsResult.parse(await response.json());
if (!data.ok) {
  throw new Error("Failed to fetch analytics data");
}
if (!data.num_found) {
  throw new Error("No users found");
}
const member = data.member_activity[0];
console.log(
  `${member.display_name} sent ${member.messages_posted} messages in the last 30 days`
);
