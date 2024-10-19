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
  slack_huddles_count: z.number().nonnegative(),
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
    console.warn(Bun.color("orange", "ansi"), `Found ${data.num_found} users`);
  }
  const member = data.member_activity.find(
    (member) => member.username === username
  );

  if (!member) {
    throw new Error(`User ${username} not found`);
  }

  return member;
}

export const UserProfileResult = z.object({
  ok: z.boolean(),
  profile: z.object({
    image_original: z.string().url(),
  }),
});
export async function getUserProfile(
  userId: string,
  xoxc: string,
  xoxd: string
) {
  const authCookie = `d=${encodeURIComponent(xoxd)}`;
  const formData = new FormData();
  formData.append("user", userId);
  formData.append("token", xoxc);

  const response = await fetch(`https://slack.com/api/users.profile.get`, {
    method: "POST",
    headers: {
      Cookie: authCookie,
    },
    body: formData,
  });
  if (!response.ok) throw new Error("Status code != 200");
  const r = await response.json();
  const data = UserProfileResult.parse(r);
  if (!data.ok) throw new Error("Slack profile API returned error");

  return data.profile;
}

// Yuck. Fix your API Slack!
export const UserSectionsResult = z.object({
  ok: z.boolean(),
  result: z.object({
    data: z.object({
      user: z.object({
        profileSections: z.array(
          z.object({
            label: z.string(),
            profileElements: z.array(
              z.object({
                date: z.string().optional(),
                uri: z.string().url().optional(),
                text: z.string().optional(),
                label: z.string(),
              })
            ),
          })
        ),
      }),
    }),
  }),
});

// If you ever need to use this code, all I can say is good luck, and God bless.
export async function getUserProfileSections(
  userId: string,
  xoxc: string,
  xoxd: string
) {
  const authCookie = `d=${encodeURIComponent(xoxd)}`;
  const formData = new FormData();
  formData.append("user", userId);
  formData.append("token", xoxc);

  const response = await fetch(
    `https://slack.com/api/users.profile.getSections`,
    {
      method: "POST",
      headers: { Cookie: authCookie },
      body: formData,
    }
  );

  if (!response.ok) throw new Error("Status code != 200");

  const result = await response.json();
  const data = UserSectionsResult.parse(result);

  if (!data.ok) throw new Error("Slack profile API returned error");

  return data.result.data.user.profileSections.map(
    ({ label, profileElements }) => ({
      label,
      profileElements: profileElements
        .map(({ date, uri, text, label }) =>
          date || uri || text ? { date, uri, text, label } : null
        )
        .filter(Boolean),
    })
  );
}
