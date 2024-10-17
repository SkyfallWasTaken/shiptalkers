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
  num_found: z.number().min(1).max(1),
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
  formData.append("count", "1");

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

  const data = AnalyticsResult.parse(await response.json());
  if (!data.ok) {
    throw new Error("Failed to fetch analytics data");
  }
  const member = data.member_activity[0];
  if (member.username !== username) {
    throw new Error(`${member.username} != ${username}`);
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
      headers: {
        Cookie: authCookie,
      },
      body: formData,
    }
  );
  if (!response.ok) throw new Error("Status code != 200");
  const r = await response.json();
  const data = UserSectionsResult.parse(r);
  if (!data.ok) throw new Error("Slack profile API returned error");
  const sections = data.result.data.user.profileSections.map((section) => {
    return {
      label: section.label,
      profileElements: section.profileElements
        .map((element) => {
          if (!element.uri && !element.text && !element.date) {
            return null;
          }
          return {
            date: element.date,
            uri: element.uri,
            text: element.text,
            label: element.label,
          };
        })
        .filter(Boolean), // Removes falsy values
    };
  });

  console.log(JSON.stringify(sections, null, 2));
  return sections;
}
