import satori from "satori";
import { readFile, writeFile } from "fs/promises"
import { formatDuration } from "./util";
import { Resvg } from "@resvg/resvg-js";

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

const WIDTH = 600;
const HEIGHT = 400;
export default async function generateImage(data: FinalData) {
  let svg = await satori(
    <div tw="flex flex-col w-full h-full items-center justify-start bg-[#1e1e2e] text-[#cdd6f4] relative">
      <div tw="flex flex-col w-full px-8 py-6 md:items-center justify-between">
        <h2 tw="flex flex-wrap items-center justify-center text-4xl font-bold tracking-tight">
          <img src={data.avatarUrl} width="64" height="64" tw="rounded-full mr-3" />
          <span tw="mr-2">{data.slack.displayName} spends</span>
          <span tw={`${data.slackTimeEstimate.seconds > data.codingTimeSeconds ? "text-red-400" : "text-green-400"} mr-2`}>{Math.abs(data.slackTimeEstimate.percentage)}% {data.slackTimeEstimate.seconds > data.codingTimeSeconds ? "more" : "less"} time</span>
          <span tw="mr-2">on Slack than coding</span>
        </h2>
        <div tw="mt-1 flex md:mt-0 justify-center">
          <StatCard label="Time spent on Slack" value={formatDuration(data.slackTimeEstimate.seconds)} />
          <span tw="text-2xl font-semibold items-center mx-4">vs</span>
          <StatCard label="Time spent coding" value={formatDuration(data.codingTimeSeconds)} />
        </div>
      </div>
      <span tw="text-[#f9e2af] font-semibold text-xl absolute bottom-5">Get yours at #shiptalkers!</span>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
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

  await writeFile("output.svg", svg)
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: WIDTH,
    }
  })
  const pngData = await resvg.render()
  const pngBuffer = pngData.asPng()
  return pngBuffer;
}