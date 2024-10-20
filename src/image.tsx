import satori from "satori";
import { readFile } from "fs/promises"
import { formatDuration } from "./util";

// TODO: move somewhere else
export interface FinalData {
  avatarUrl: string;
  slack: {
    displayName: string;
    username: string;
  };
  github: {
    username: string;
    url: string;
  };
  codingTimeSeconds: number;
  slackTimeEstimate: {
    seconds: number;
    percentage: number;
  };
}

const regularFontBuffer = await readFile('fonts/Outfit-Regular.ttf')
const boldFontBuffer = await readFile('fonts/Outfit-Bold.ttf')

interface StatCardProps {
  label: string;
  value: string;
}
function StatCard(props: StatCardProps) {
  return (
    <div tw="flex flex-col items-center rounded-md shadow bg-[#313244] px-5 py-4">
      <span tw="font-semibold text-lg mb-2">{props.label}</span>
      <span tw="font-black text-3xl">{props.value}</span>
    </div>
  )
}

export default async function generateImage(data: FinalData) {
  return await satori(
    <div tw="flex flex-col w-full h-full items-center justify-center bg-[#1e1e2e] text-[#cdd6f4] relative">
      <div tw="flex flex-col w-full py-12 px-4 md:items-center justify-between p-8">
        <h2 tw="flex flex-wrap items-center justify-center text-4xl font-bold tracking-tight">
          <img src={data.avatarUrl} width="64" height="64" tw="border-2 border-red-400 bg-red-400 rounded-full mr-3" />
          <span tw="mr-2">{data.slack.displayName} spends</span>
          <span tw="text-red-400 mr-2">{data.slackTimeEstimate.percentage}% more time</span>
          <span tw="mr-2">on Slack than coding</span>
        </h2>
        <div tw="mt-8 flex md:mt-0">
          <StatCard label="Time spent on Slack" value={formatDuration(data.slackTimeEstimate.seconds)} />
          <span tw="text-2xl font-semibold items-center mx-4">vs</span>
          <StatCard label="Time spent coding" value={formatDuration(data.codingTimeSeconds)} />
        </div>
      </div>
      <span tw="text-[#f9e2af] font-semibold text-lg absolute bottom-5">Get yours at #shiptalkers!</span>
    </div>,
    {
      width: 600,
      height: 400,
      fonts: [
        {
          name: 'Outfit',
          data: regularFontBuffer,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Outfit',
          data: boldFontBuffer,
          weight: 700,
          style: 'normal',
        }
      ],
    },
  )
}