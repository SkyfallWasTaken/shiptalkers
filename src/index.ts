import "dotenv/config";
import generateImage from "./image";
import type { FinalData } from "./image";
import { z } from "zod";
import { fetchMemberAnalyticsData } from "./slackAnalytics";
import { flattenObject } from "./util";
import { WebClient } from "@slack/web-api";
import { Temporal } from "@js-temporal/polyfill";
const { App } = await import("@slack/bolt");

export enum Mode {
  Last30Days,
  LastYear,
  AdrianMethod,
}

// Constants for time calculations
const TIME_CONSTANTS = {
  SECONDS_PER_MESSAGE: 50,
  SECONDS_PER_REACTION: 12,
  MINUTES_PER_DESKTOP_DAY: 35,
  MINUTES_PER_MOBILE_DAY: 30,
  SECONDS_PER_MINUTE: 60,
};

export const Env = z.object({
  WORKSPACE: z.string(),
  SLACK_CHANNEL_ID: z.string().length(11),
  XOXC: z.string().startsWith("xoxc-", "XOXC is invalid"),
  XOXD: z.string().startsWith("xoxd-", "XOXD is invalid"),
  XOXB: z.string().startsWith("xoxb-", "XOXB is invalid"),
  SLACK_APP_TOKEN: z.string(),
  WAKATIME_STATS_ENDPOINT: z.string().url().includes(":id"),
  PORT: z.number().optional(),
  AD: z.string().default(""),
});
const env = Env.parse(process.env);
env.XOXD = decodeURIComponent(env.XOXD);

const slack = new WebClient(env.XOXB);
const bolt = new App({
  appToken: env.SLACK_APP_TOKEN,
  token: env.XOXB,
  socketMode: true,
});

// Helper functions
function determineMode(messageText: string | undefined): Mode {
  const text = messageText?.toLowerCase() || "";
  if (text.includes("adrian method")) return Mode.AdrianMethod;
  if (text.includes("one year")) return Mode.LastYear;
  return Mode.Last30Days;
}

function getWakaTimeMode(mode: Mode): string {
  switch (mode) {
    case Mode.LastYear:
      return "last_year";
    case Mode.AdrianMethod:
      return "all_time";
    default:
      return "last_30_days";
  }
}

function getStartDate(mode: Mode): string {
  const currentDate = Temporal.Now.plainDateISO();
  switch (mode) {
    case Mode.LastYear:
      return currentDate.subtract({ years: 1 }).toString();
    case Mode.AdrianMethod:
      return currentDate.toString();
    default:
      return currentDate.subtract({ months: 1 }).toString();
  }
}

function calculateSlackTimeEstimate(analytics: any): number {
  return Math.floor(
    analytics.messages_posted * TIME_CONSTANTS.SECONDS_PER_MESSAGE +
      analytics.reactions_added * TIME_CONSTANTS.SECONDS_PER_REACTION +
      analytics.days_active_desktop *
        TIME_CONSTANTS.SECONDS_PER_MINUTE *
        TIME_CONSTANTS.MINUTES_PER_DESKTOP_DAY +
      (analytics.days_active_android + analytics.days_active_ios) *
        TIME_CONSTANTS.SECONDS_PER_MINUTE *
        TIME_CONSTANTS.MINUTES_PER_MOBILE_DAY
  );
}

async function sendErrorMessage(
  channel: string,
  thread_ts: string,
  message: string
) {
  await slack.chat.postMessage({
    channel,
    text: message,
    thread_ts,
  });
}

bolt.message(async ({ message }) => {
  // Only process direct messages that aren't in threads
  if (message.subtype || message.thread_ts) return;

  try {
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

    // Handle specific keywords
    if (
      message.text?.toLowerCase().includes("all") ||
      message.text?.toLowerCase().includes("forever") ||
      message.text?.toLowerCase().includes("lifetime")
    ) {
      await sendErrorMessage(
        message.channel,
        message.ts,
        "All time isn't added due to Slack limitations. Try `one month` or `one year` instead."
      );
      return;
    }

    const mode = determineMode(message.text);
    const slackAnalytics = await fetchMemberAnalyticsData(
      slackInfo.user?.name!,
      env.XOXC,
      env.XOXD,
      env.WORKSPACE,
      mode
    );

    const wakaMode = getWakaTimeMode(mode);
    const startDate = getStartDate(mode);

    const baseEndpoint = env.WAKATIME_STATS_ENDPOINT.replace(
      ":id",
      slackAnalytics.user_id
    ).replace(":range", wakaMode);

    const wakaResponse = await fetch(`${baseEndpoint}?start_date=${startDate}`);
    if (!wakaResponse.ok) {
      await sendErrorMessage(
        message.channel,
        message.ts,
        "Failed to fetch WakaTime data!\nPlease go to https://waka.hackclub.com/settings#permissions and set the time range to `-1`"
      );
      return;
    }

    const waka = await wakaResponse.json();
    const codingTimeSeconds: number = waka.data.total_seconds;
    const slackTimeEstimateSecs = calculateSlackTimeEstimate(slackAnalytics);

    // Work out the percentage of more time spent on slack
    const percentage = Math.round(
      ((slackTimeEstimateSecs - codingTimeSeconds) / codingTimeSeconds) * 100
    );

    const overallProfile: FinalData = {
      avatarUrl:
        slackProfile.image_original ||
        "https://hc-cdn.hel1.your-objectstorage.com/s/v3/a3ed8a745a17f92f8a16a00dd79e0218930cf461_image.png", // A ghost!
      slack: {
        displayName: slackAnalytics.display_name,
        username: slackAnalytics.username,
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
      initial_comment: env.AD,
      filename: "shiptalkers.png",
      file: png,
      thread_ts: message.ts,
    });

    if (!fileUploadResponse.ok) throw new Error("Failed to upload file");
  } catch (error) {
    console.error("Error processing message:", error);
    try {
      await sendErrorMessage(
        message.channel,
        message.ts,
        "An error occurred while processing your request."
      );
    } catch (e) {
      console.error("Failed to send error message:", e);
    }
  }
});

await bolt.start(env.PORT || 3000);
console.log("⚡️ Shiptalkers is running!");
