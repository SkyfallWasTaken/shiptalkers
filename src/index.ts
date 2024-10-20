import "dotenv/config";
import { z } from "zod";
import { fetchMemberAnalyticsData } from "./slackAnalytics";
import { flattenObject } from "./util";
import type { FinalData } from "./image";
import generateImage from "./image";
import { WebClient } from "@slack/web-api";
const { App } = await import("@slack/bolt");

import { toTemporalInstant } from "@js-temporal/polyfill";
// @ts-ignore
Date.prototype.toTemporalInstant = toTemporalInstant;

export enum Mode {
  Last30Days,
  LastYear,
  AdrianMethod,
}

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
    if (slackInfo.user?.is_bot) return;
    if (!slackProfile) throw new Error("No profile found");

    const oneYear = message.text?.toLowerCase().includes("one year") || false;
    const adrianMethod =
      message.text?.toLowerCase().includes("adrian method") || false;
    const mode = adrianMethod
      ? Mode.AdrianMethod
      : oneYear
        ? Mode.LastYear
        : Mode.Last30Days;
    const slackAnalytics = await fetchMemberAnalyticsData(
      slackInfo.user?.name!,
      env.XOXC,
      env.XOXD,
      env.WORKSPACE,
      mode
    );

    const rawGithubUrl =
      Object.values(slackProfile.fields!).find((field) =>
        field.value?.includes("github.com")
      )?.value || "https://github.com/ghost"; // FIXME: yes
    const avatarUrl =
      slackProfile.image_original ||
      "https://ca.slack-edge.com/T0266FRGM-U07SPF9D4BU-g7bf54aa89eb-48";
    if (!rawGithubUrl) throw new Error("No github url found");
    const githubUrl = new URL(rawGithubUrl);
    const githubUsername = githubUrl.pathname.split("/")[1];

    const wakaMode = (() => {
      if (mode == Mode.LastYear) return "last_year";
      if (mode == Mode.AdrianMethod) return "all_time";
      return "last_30_days";
    })();
    const wakaResponse = await fetch(
      env.WAKATIME_STATS_ENDPOINT.replace(
        ":id",
        slackAnalytics.user_id
      ).replace(":range", wakaMode)
    );
    if (!wakaResponse.ok) {
      return slack.chat.postMessage({
        channel: message.channel,
        text: "Failed to fetch WakaTime data!\nPlease go to https://waka.hackclub.com/settings#permissions and set the time range to `-1`",
        thread_ts: message.ts,
      });
    }
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
