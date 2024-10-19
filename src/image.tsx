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

const fontBuffer = await readFile('fonts/Outfit-Regular.ttf')
export default async function generateImage(data: FinalData) {
  const svg = await satori(
    <div style={{ color: 'black' }}>hello, world</div>,
    {
      width: 600,
      height: 400,
      fonts: [
        {
          name: 'Outfit',
          // Use `fs` (Node.js only) or `fetch` to read the font as Buffer/ArrayBuffer and provide `data` here.
          data: fontBuffer,
          weight: 400,
          style: 'normal',
        },
      ],
    },
  )

  const transformer = Transformer.fromSvg(svg);
  return await transformer.png();
}