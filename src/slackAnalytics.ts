import { z } from "zod";

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
  // slack_huddles_count: z.number().nonnegative(), Always 0 on non-Enterprise plans
});
export const AnalyticsResult = z.object({
  ok: z.boolean(),
  num_found: z.number().min(1),
  member_activity: z.array(MemberActivity).min(1),
});

export async function fetchMemberAnalyticsData(
  username: string,
  xoxc: string,
  xoxd: string,
  workspace: string
) {
  const formData = new FormData();
  formData.append("token", xoxc);
  formData.append("date_range", "30d");
  formData.append("count", "1");
  formData.append("sort_column", "username");
  formData.append("sort_direction", "asc");
  formData.append("query", username);
  formData.append("count", "3");

  const authCookie = `d=${encodeURIComponent(xoxd)}`;
  const response = await fetch(
    `https://${workspace}.slack.com/api/admin.analytics.getMemberAnalytics`,
    {
      method: "POST",
      body: formData,
      headers: {
        Authority: `${workspace}.slack.com`,
        Cookie: authCookie, // We don't really need anything fancy here.
      },
    }
  );

  const json = await response.json();
  // console.log(json);
  const data = AnalyticsResult.parse(json);
  if (!data.ok) {
    throw new Error("Failed to fetch analytics data");
  }
  if (data.num_found > 1) {
    console.warn(`[WARN] Found ${data.num_found} users`);
  }
  const member = data.member_activity.find(
    (member) => member.username === username
  );

  if (!member) {
    throw new Error(`User ${username} not found`);
  }

  return member;
}