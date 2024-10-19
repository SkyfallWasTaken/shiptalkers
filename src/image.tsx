import satori from "satori";
import { Transformer } from '@napi-rs/image';
import { readFile } from "fs/promises"

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
    slackTimeEstimateSecs: number;
    percentage: number;
  };
}

const regularFontBuffer = await readFile('fonts/Outfit-Regular.ttf')
const boldFontBuffer = await readFile('fonts/Outfit-Bold.ttf')

export default async function generateImage(data: FinalData) {
  const svg = await satori(
    <div tw="flex flex-col w-full h-full items-center justify-center bg-white">
      <div tw="bg-gray-50 flex w-full">
        <div tw="flex flex-col md:flex-row w-full py-12 px-4 md:items-center justify-between p-8">
          <h2 tw="flex flex-col text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 text-left">
            <span>Ready to dive in?</span>
            <span tw="text-indigo-600">Start your free trial today.</span>
          </h2>
          <div tw="mt-8 flex md:mt-0">
            <div tw="flex rounded-md shadow">
              <a tw="flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-5 py-3 text-base font-medium text-white">Get started</a>
            </div>
            <div tw="ml-3 flex rounded-md shadow">
              <a tw="flex items-center justify-center rounded-md border border-transparent bg-white px-5 py-3 text-base font-medium text-indigo-600">Learn more</a>
            </div>
          </div>
        </div>
      </div>
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

  const transformer = Transformer.fromSvg(svg);
  return await transformer.png();
}