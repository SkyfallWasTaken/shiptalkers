import "dotenv/config";
import { z } from "zod";
import { fetchMemberAnalyticsData } from "./slackAnalytics";
import { flattenObject } from "./util";
import type { FinalData } from "./image";
import generateImage from "./image";
import { WebClient } from "@slack/web-api";
const { App } = await import("@slack/bolt");

export const Env = z.object({
  WORKSPACE: z.string(),
  SLACK_CHANNEL_ID: z.string().length(11),
  XOXC: z.string().startsWith("xoxc-", "XOXC is invalid"),
  XOXD: z.string().startsWith("xoxd-", "XOXD is invalid"),
  XOXB: z.string().startsWith("xoxb-", "XOXB is invalid"),
  SLACK_APP_TOKEN: z.string(),
  WAKATIME_STATS_ENDPOINT: z.string().url().includes(":id").includes(":range"),
  PORT: z.number().optional(),
});
const env = Env.parse(process.env);
env.XOXD = decodeURIComponent(env.XOXD);

const slack = new WebClient(env.XOXB);
const bolt = new App({
  appToken: env.SLACK_APP_TOKEN,
  token: env.XOXB,
  socketMode: true,
});

bolt.message(async ({ message }) => {
  if (!message.subtype && !message.thread_ts) {
    const slackProfile = (
      await slack.users.profile.get({
        user: message.user,
      })
    ).profile;
    const slackInfo = await slack.users.info({
      user: message.user,
    });
    if (!slackProfile) throw new Error("No profile found");

    const slackAnalytics = await fetchMemberAnalyticsData(
      slackInfo.user?.name!,
      env.XOXC,
      env.XOXD,
      env.WORKSPACE
    );

    const rawGithubUrl = Object.values(slackProfile.fields!).find((field) =>
      field.value?.includes("github.com")
    )?.value;
    const avatarUrl = slackProfile.image_original;
    if (!rawGithubUrl) throw new Error("No github url found");
    if (!avatarUrl) throw new Error("No avatar url found");
    const githubUrl = new URL(rawGithubUrl);
    const githubUsername = githubUrl.pathname.split("/")[1];

    const wakaResponse = await fetch(
      env.WAKATIME_STATS_ENDPOINT.replace(
        ":id",
        slackAnalytics.user_id
      ).replace(":range", "last_30_days")
    );
    if (!wakaResponse.ok)
      throw new Error(`Status code != 200, it was ${wakaResponse.status}`);
    const waka = await wakaResponse.json();
    const codingTimeSeconds: number = waka.data.total_seconds;
    const slackTimeEstimateSecs = Math.floor(
      slackAnalytics.messages_posted * 30 +
        slackAnalytics.reactions_added * 5 +
        slackAnalytics.days_active_desktop * 60 * 20 +
        (slackAnalytics.days_active_android + slackAnalytics.days_active_ios) *
          60 *
          10
    );

    // Work out the percentage of more time spent on slack
    const percentage = Math.round(
      ((slackTimeEstimateSecs - codingTimeSeconds) / codingTimeSeconds) * 100
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
    const png = await generateImage(overallProfile);

    const fileUploadResponse = await slack.filesUploadV2({
      channel_id: env.SLACK_CHANNEL_ID,
      filename: "shiptalkers.png",
      file: png,
      thread_ts: message.ts,
    });
    if (!fileUploadResponse.ok) throw new Error("Failed to upload file");
  }
});
await bolt.start(env.PORT || 3000);
console.log("⚡️ Shiptalkers is running!");
