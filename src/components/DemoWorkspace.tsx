import { Route as RootRoute } from '../routes/__root'
import React from 'react'
import { Collapsible } from '@base-ui/react/collapsible'
import { DemoImportStatus } from '../components/DemoImportStatus'
import type { ImportState, ReadyImportState } from '#/demo/session'
import { mapDefinition } from '#/replay/maps'
import { preloadMapAssets } from '#/replay/round-layer'
import { DemoMap, type DemoPlaybackState, type DemoCameraState } from '#/components/DemoMap'
import { DemoPlaybackControl } from '#/components/DemoPlaybackControl'
import type { ReplayRound } from '#/replay/types'
import type { MapDefinition } from '#/replay/maps'
import { DemoPlayerCards } from '#/components/DemoPlayerCards'
import { DemoCameraControls } from '#/components/DemoCameraControls'
import { focusedCamera, type CameraState } from '#/replay/map-camera'
import { DemoFloorControl } from '#/components/DemoFloorControl'
import { DemoRoundControl } from '#/components/DemoRoundControl'
import { ExampleDemos } from '#/components/ExampleDemos'
import { examples, type ExampleId } from '#/demo/examples'
import { playerCardsAtTick } from '#/replay/player-cards'
import { DemoKillFeed, DemoKillFeedDropdown } from '#/components/DemoKillFeed'
import { DemoRoundWin } from '#/components/DemoRoundWin'
import { DemoShortcutHelp } from './DemoShortcutHelp'
import { useReplayShortcuts } from './useReplayShortcuts'
import { DemoDrawingControl } from './DemoDrawingControl'
import {
  emptyFloorDrawings,
  type DrawingColor,
  type DrawingStroke,
  type FloorDrawings,
  type RoundDrawings,
} from '../replay/drawing'
import type { MapFloor } from '../replay/maps'

export function DemoWorkspace() {
  const { replay } = RootRoute.useRouteContext()
  const { state, source } = React.useSyncExternalStore(replay.subscribe, replay.getSnapshot)

  const [pendingExample, setPendingExample] = React.useState<ExampleId | undefined>()
  const finishAutoPlay = React.useCallback(() => setPendingExample(undefined), [])

  function upload(evt: React.ChangeEvent<HTMLInputElement>) {
    setPendingExample(undefined)
    const file = evt.currentTarget.files?.[0]
    if (!file) {
      replay.clear()
      return
    }
    replay.openFile(file)
  }

  return (
    <main className="demo-workspace min-h-dvh bg-neutral-900 p-[max(8px,env(safe-area-inset-top))_max(8px,env(safe-area-inset-right))_max(8px,env(safe-area-inset-bottom))_max(8px,env(safe-area-inset-left))] replay-desktop:h-dvh replay-desktop:p-[max(16px,env(safe-area-inset-top))_max(16px,env(safe-area-inset-right))_max(16px,env(safe-area-inset-bottom))_max(16px,env(safe-area-inset-left))]">
      <div className="demo-shell flex min-h-[calc(100dvh-16px)] flex-col rounded-3xl bg-neutral-800 text-mauve-200 replay-desktop:h-full replay-desktop:min-h-0 replay-desktop:rounded-[2rem]">
        <Header
          fileName={state.status !== 'empty' ? state.filename : undefined}
          uploadFile={upload}
          state={state}
        />
        {state.status === 'ready' &&
        mapDefinition(state.metadata.mapName) &&
        state.rounds.some((round) => round.startTick === state.selectedStartTick) ? (
          <Demo
            key={source?.kind === 'example' ? source.id : 'local'}
            state={state}
            example={source?.kind === 'example' ? source.id : undefined}
            autoPlay={source?.kind === 'example' && pendingExample === source.id}
            onAutoPlay={finishAutoPlay}
          />
        ) : source &&
          !pendingExample &&
          (state.status === 'reading' ||
            (state.status === 'ready' &&
              state.parsing.status === 'active' &&
              mapDefinition(state.metadata.mapName))) ? (
          // A shared replay link: the catalog's images would compete with the first round.
          <ReplayLoading
            map={mapDefinition(
              source.kind === 'example'
                ? examples[source.id].map
                : state.status === 'ready'
                  ? state.metadata.mapName
                  : '',
            )}
          />
        ) : (
          <ExampleDemos
            state={state}
            activeExample={source?.kind === 'example' ? source.id : undefined}
            onSelect={(id) => {
              setPendingExample(id)
              replay.openExample(id)
            }}
          />
        )}
      </div>
    </main>
  )
}

function ReplayLoading({ map }: { map: MapDefinition | undefined }) {
  React.useEffect(() => {
    if (map) preloadMapAssets(map)
  }, [map])
  return (
    <div className="demo-content flex min-h-0 flex-1 items-center justify-center px-2 pb-2">
      <output className="text-sm text-mauve-200/65">Loading replay…</output>
    </div>
  )
}

function Header({
  fileName,
  uploadFile,
  state,
}: {
  fileName: string | undefined
  uploadFile: (e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => void
  state: ImportState
}) {
  const labelText = fileName ? fileName : 'No demo chosen'

  return (
    <header className="shrink-0">
      <div className="demo-header grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 lg:pr-7 lg:pl-10 replay-desktop:flex replay-desktop:justify-between replay-desktop:py-4 replay-landscape:grid-cols-[auto_minmax(0,1fr)_auto]">
        <a
          href="/"
          aria-label="Return to example demos"
          className="demo-home flex min-h-11 items-center rounded-xl pl-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 replay-desktop:pl-0"
        >
          <svg
            aria-hidden="true"
            width="48"
            height="12"
            viewBox="0 0 48 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="demo-logo h-8 w-32 shrink-0 fill-mauve-200"
          >
            <path d="M3.696 11.508L3.024 11.592C3.276 11.052 3.444 10.488 3.444 9.81603V9.78003H0.059996V9.54003H1.02V7.88403C1.02 4.21203 0.911996 3.28803 0.719996 2.31603H-4.02331e-06V2.07603C1.284 2.08803 2.376 1.90803 2.856 1.76403C2.76 3.02403 2.724 3.78003 2.724 5.47203V6.00003H3.444V0.108029L4.14 2.86102e-05C3.864 0.576029 3.696 1.38003 3.696 2.06403V2.68803C3.912 1.98003 4.32 1.64403 5.016 1.64403C6.6 1.64403 7.944 2.50803 7.944 3.76803C7.944 5.08803 6.696 6.09603 4.692 6.22803C5.256 6.91203 5.916 8.01603 6.852 9.01203C7.596 9.82803 8.184 10.272 8.736 10.272C9.012 10.272 9.276 10.164 9.552 9.93603L9.696 10.092C9.624 10.176 9.54 10.248 9.444 10.332C8.772 10.968 8.04 11.316 7.356 11.316C6.816 11.316 6.312 11.1 5.868 10.62C4.752 9.39603 5.088 7.53603 4.452 6.24003H3.696V9.54003H4.44V9.78003H3.696V11.508ZM3.696 5.17203V6.00003H4.26C5.472 6.00003 5.904 5.26803 5.904 3.94803C5.904 2.61603 5.52 1.89603 4.872 1.89603C3.9 1.89603 3.696 3.26403 3.696 5.17203ZM3.444 9.54003V6.24003H2.724C2.736 7.30803 2.784 8.53203 2.868 9.54003H3.444ZM10.4618 9.85203C9.72984 9.64803 8.64984 9.07203 8.33784 8.53203C8.46984 8.08803 8.51784 7.69203 8.51784 6.87603V5.05203L9.28584 4.83603L10.0418 3.70803L11.5298 4.10403C12.2858 4.30803 12.4058 4.47603 12.4058 5.73603V7.94403C11.5538 8.70003 11.1338 9.09603 10.4618 9.85203ZM9.72984 7.92003C10.0058 8.23203 10.4138 8.49603 11.0378 8.77203C11.0738 8.05203 11.0978 7.38003 11.0978 6.67203C11.0978 6.25203 11.0858 5.83203 11.0738 5.37603C10.7378 5.24403 10.2818 5.12403 9.86184 5.00403V6.36003C9.86184 6.99603 9.82584 7.39203 9.72984 7.92003ZM17.3177 9.85203C16.7897 9.57603 16.2257 9.03603 15.9377 8.54403C15.6017 9.01203 15.1937 9.42003 14.7737 9.85203C14.2457 9.57603 13.6817 9.03603 13.3937 8.53203C13.5257 8.08803 13.5737 7.69203 13.5737 6.87603V5.12403L12.9257 4.81203C12.8417 4.89603 12.7577 5.00403 12.6617 5.11203L12.4937 4.93203C12.8777 4.58403 13.2257 4.18803 13.6337 3.70803L14.9177 4.27203V6.36003C14.9177 7.10403 14.8817 7.64403 14.7857 8.04003C14.9177 8.30403 15.1337 8.48403 15.4697 8.72403C15.6857 8.47203 15.8897 8.18403 16.0697 7.87203C16.1057 7.60803 16.1177 7.29603 16.1177 6.87603V5.23203C15.8657 5.05203 15.5897 4.92003 15.3137 4.81203L16.0817 3.70803L16.9697 4.11603C17.3777 4.30803 17.4617 4.65603 17.4617 5.01603V6.36003C17.4617 7.10403 17.4257 7.64403 17.3297 8.04003C17.4737 8.30403 17.6777 8.48403 18.0377 8.73603C18.1217 8.65203 18.2057 8.55603 18.2897 8.44803L18.4577 8.62803C18.0737 8.97603 17.7257 9.37203 17.3177 9.85203ZM22.556 9.85203C22.028 9.57603 21.464 9.03603 21.176 8.53203C21.308 8.08803 21.356 7.69203 21.356 6.87603V5.23203C21.068 5.08803 20.78 4.96803 20.468 4.87203C20.372 4.99203 20.264 5.12403 20.156 5.28003V6.36003C20.156 7.08003 20.132 7.64403 20.024 8.04003C20.18 8.34003 20.432 8.53203 20.876 8.83203L20.012 9.85203C19.484 9.57603 18.92 9.03603 18.632 8.53203C18.764 8.08803 18.812 7.69203 18.812 6.87603V5.12403L18.164 4.81203C18.08 4.89603 17.996 5.00403 17.9 5.11203L17.732 4.93203C18.116 4.58403 18.464 4.18803 18.872 3.70803L20.156 4.27203V4.84803C20.432 4.40403 20.744 4.02003 21.056 3.70803L22.208 4.17603C22.628 4.34403 22.7 4.68003 22.7 5.01603V6.36003C22.7 7.08003 22.676 7.64403 22.568 8.04003C22.712 8.30403 22.916 8.48403 23.276 8.73603C23.36 8.65203 23.444 8.55603 23.528 8.44803L23.696 8.62803C23.312 8.97603 22.964 9.37203 22.556 9.85203ZM25.8262 9.85203C25.1062 9.64803 24.0982 9.07203 23.7862 8.53203C23.9182 8.08803 23.9662 7.69203 23.9662 6.87603V5.05203L25.3102 4.68003V6.36003C25.3102 6.93603 25.2622 7.54803 25.1782 7.92003C25.4542 8.23203 25.8022 8.50803 26.4022 8.77203C26.4502 8.16003 26.4742 7.46403 26.4742 6.66003C26.4742 6.12003 26.4622 5.53203 26.4382 4.89603L23.4982 3.26403C22.8742 2.91603 22.7782 2.62803 23.2222 2.07603C23.5102 1.71603 23.7382 1.39203 23.9542 0.972029L24.1342 1.10403L23.9542 1.41603C23.9182 1.48803 23.8942 1.57203 23.8942 1.64403C23.8942 1.96803 24.3982 2.36403 26.9782 3.66003C27.6502 3.99603 27.7702 4.40403 27.7702 5.25603V7.94403C26.9182 8.70003 26.4982 9.09603 25.8262 9.85203ZM30.9993 9.21603L30.4593 9.85203C29.8473 9.68403 29.1273 9.04803 28.8273 8.53203C28.9593 8.08803 29.0073 7.69203 29.0073 6.87603V4.21203C28.7433 4.23603 28.4793 4.26003 28.1913 4.30803L28.3473 3.78003H29.0073V2.96403L30.1353 2.30403V1.08003L30.4953 0.972029C30.4113 1.56003 30.3513 1.76403 30.3513 2.44803V3.78003H31.6233L31.4673 4.26003C31.2153 4.23603 30.8193 4.20003 30.3513 4.18803V6.63603C30.3393 7.21203 30.3033 7.70403 30.2193 8.04003C30.4353 8.31603 30.7113 8.54403 31.1433 8.74803C31.2513 8.64003 31.3473 8.52003 31.4673 8.37603L31.6353 8.55603C31.4193 8.76003 31.2153 8.97603 30.9993 9.21603ZM35.1312 9.85203C34.6512 9.60003 34.1472 9.14403 33.8472 8.68803C33.5712 9.09603 33.2712 9.49203 32.9352 9.85203C32.3592 9.63603 31.7112 9.03603 31.4112 8.53203C31.5312 8.11203 31.5912 7.75203 31.5912 6.99603V6.69603L32.3712 6.46803C31.8672 6.32403 31.6272 5.97603 31.6272 5.59203C31.6272 5.29203 31.8192 4.94403 32.0712 4.63203L32.8272 3.70803L34.7832 4.11603C35.1312 4.18803 35.2752 4.51203 35.2752 5.01603V6.37203C35.2752 6.99603 35.2272 7.57203 35.1432 8.04003C35.2872 8.30403 35.4912 8.48403 35.8512 8.73603C35.9352 8.65203 36.0192 8.55603 36.1032 8.44803L36.2712 8.62803C35.8872 8.97603 35.5392 9.37203 35.1312 9.85203ZM33.1152 6.28803C33.3552 6.28803 33.6552 6.24003 33.9312 6.13203V5.23203C33.3912 5.06403 32.8632 4.92003 32.2992 4.84803C32.1792 5.07603 32.1312 5.28003 32.1312 5.40003C32.1312 5.88003 32.3472 6.28803 33.1152 6.28803ZM32.7672 7.98003C32.9592 8.25603 33.1752 8.46003 33.5352 8.66403C33.8592 8.19603 33.9312 7.40403 33.9312 6.86403V6.37203C33.5352 6.51603 33.2352 6.54003 32.9232 6.54003H32.8992V6.69603C32.8992 7.12803 32.8392 7.66803 32.7672 7.98003ZM38.5802 9.85203C37.8482 9.64803 36.7682 9.07203 36.4562 8.53203C36.5882 8.08803 36.6362 7.69203 36.6362 6.87603V2.55603L35.9882 2.24403C35.9042 2.32803 35.8202 2.43603 35.7242 2.54403L35.5562 2.36403C35.9402 2.01603 36.2882 1.62003 36.6962 1.14003L37.7642 1.60803V0.336029L38.1242 0.228029C38.0282 0.756029 37.9802 1.02003 37.9802 1.70403V4.82403C38.2562 4.39203 38.5562 4.02003 38.8682 3.70803L40.0202 4.17603C40.4522 4.35603 40.5242 4.68003 40.5242 5.01603V7.94403C39.6722 8.70003 39.2522 9.09603 38.5802 9.85203ZM37.9802 6.36003C37.9802 6.97203 37.9442 7.54803 37.8722 7.94403C38.1482 8.24403 38.5562 8.50803 39.1562 8.77203C39.1922 8.06403 39.2162 7.40403 39.2162 6.72003C39.2162 6.25203 39.2162 5.78403 39.1922 5.29203C38.8322 5.11203 38.5562 5.00403 38.2442 4.92003C38.1602 5.01603 38.0762 5.13603 37.9802 5.26803V6.36003ZM43.0544 1.70403V6.36003C43.0544 6.96003 43.0184 7.62003 42.9224 8.04003C43.0544 8.29203 43.2104 8.49603 43.5104 8.73603C43.5944 8.65203 43.6784 8.55603 43.7624 8.44803L43.9304 8.62803C43.5464 8.97603 43.1984 9.37203 42.7904 9.85203C42.2984 9.60003 41.8184 9.02403 41.5304 8.53203C41.6624 8.08803 41.7104 7.69203 41.7104 6.87603V2.55603L41.0624 2.24403C40.9784 2.32803 40.8944 2.43603 40.7984 2.54403L40.6304 2.36403C41.0144 2.01603 41.3624 1.62003 41.7704 1.14003L42.8384 1.60803V0.336029L43.1984 0.228029C43.1024 0.756029 43.0544 1.02003 43.0544 1.70403ZM46.0737 9.85203C45.3537 9.64803 44.4057 9.07203 44.0937 8.53203C44.2257 8.10003 44.2737 7.70403 44.2737 6.91203C44.0817 6.92403 43.8777 6.96003 43.6257 6.99603L43.7817 6.66003H44.2737V5.06403L45.1857 4.81203L45.9417 3.70803L47.1177 4.38003C47.4177 4.54803 47.5617 4.92003 47.2737 5.25603C46.8537 5.76003 46.3737 6.20403 45.8817 6.66003H47.2977L47.1417 6.94803C46.8177 6.91203 46.2537 6.87603 45.6057 6.87603C45.5817 7.28403 45.5457 7.65603 45.4857 7.92003C45.7617 8.22003 46.1577 8.49603 46.7577 8.74803C46.8537 8.64003 46.9617 8.52003 47.0817 8.37603L47.2497 8.55603C47.0337 8.76003 46.8297 8.97603 46.6137 9.21603L46.0737 9.85203ZM45.6177 6.58803C45.9297 6.28803 46.2297 6.01203 46.5537 5.68803C46.2657 5.43603 45.9777 5.24403 45.6177 5.06403V6.58803Z" />
          </svg>
        </a>
        <div className="demo-upload-container col-span-full row-start-2 min-w-0 replay-desktop:w-[min(45%,500px)] replay-landscape:col-auto replay-landscape:row-auto">
          <label className="demo-upload relative flex min-h-11 min-w-0 cursor-pointer flex-wrap items-center rounded-2xl bg-neutral-900/75 p-1 text-xs outline-offset-2 focus-within:outline-2 focus-within:outline-mauve-200 hover:bg-neutral-900 replay-desktop:text-base">
            <span className="mr-2 flex min-h-9 shrink-0 items-center rounded-xl bg-neutral-600 px-3 py-1 text-mauve-200">
              Choose demo
            </span>
            <span className="min-w-0 flex-1 truncate" title={labelText}>
              {labelText}
            </span>
            <DemoImportStatus state={state} />
            <input
              type="file"
              accept=".dem"
              aria-label="Choose demo"
              className="sr-only"
              onChange={uploadFile}
            />
          </label>
        </div>
        <div className="demo-github justify-self-end">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/joshfootman/roundtable"
            aria-label="Roundtable on GitHub"
            className="mr-1 flex min-h-11 min-w-11 items-center justify-end gap-1 rounded-2xl px-2 py-1.5 pr-0 outline-offset-2 focus-within:outline-2 focus-within:outline-mauve-200 hover:bg-mauve-100/10 sm:pr-1 lg:mr-0 replay-desktop:justify-center replay-desktop:pr-3"
          >
            <svg
              width="128"
              height="128"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-7 fill-mauve-200"
            >
              <path d="M56.7937 84.9688C44.4187 83.4688 35.7 74.5625 35.7 63.0313C35.7 58.3438 37.3875 53.2813 40.2 49.9063C38.9812 46.8125 39.1687 40.25 40.575 37.5313C44.325 37.0625 49.3875 39.0313 52.3875 41.75C55.95 40.625 59.7 40.0625 64.2937 40.0625C68.8875 40.0625 72.6375 40.625 76.0125 41.6563C78.9187 39.0313 84.075 37.0625 87.825 37.5313C89.1375 40.0625 89.325 46.625 88.1062 49.8125C91.1062 53.375 92.7 58.1563 92.7 63.0313C92.7 74.5625 83.9812 83.2813 71.4187 84.875C74.6062 86.9375 76.7625 91.4375 76.7625 96.5938V106.344C76.7625 109.156 79.1062 110.75 81.9187 109.625C98.8875 103.156 112.2 86.1875 112.2 65.1875C112.2 38.6563 90.6375 17 64.1062 17C37.575 17 16.2 38.6562 16.2 65.1875C16.2 86 29.4187 103.25 47.2312 109.719C49.7625 110.656 52.2 108.969 52.2 106.438V98.9375C50.8875 99.5 49.2 99.875 47.7 99.875C41.5125 99.875 37.8562 96.5 35.2312 90.2188C34.2 87.6875 33.075 86.1875 30.9187 85.9063C29.7937 85.8125 29.4187 85.3438 29.4187 84.7813C29.4187 83.6563 31.2937 82.8125 33.1687 82.8125C35.8875 82.8125 38.2312 84.5 40.6687 87.9688C42.5437 90.6875 44.5125 91.9063 46.8562 91.9063C49.2 91.9063 50.7 91.0625 52.8562 88.9063C54.45 87.3125 55.6687 85.9063 56.7937 84.9688Z" />
            </svg>
            <span className="hidden sm:inline">Github</span>
          </a>
        </div>
      </div>
    </header>
  )
}

function Demo({
  state,
  example,
  autoPlay,
  onAutoPlay,
}: {
  state: ReadyImportState
  example?: ExampleId
  autoPlay: boolean
  onAutoPlay: () => void
}) {
  const { replay } = RootRoute.useRouteContext()
  const map = mapDefinition(state.metadata.mapName)
  const round = state.rounds.find((round) => round.startTick === state.selectedStartTick)

  const [camera, setCamera] = React.useState(() => ({
    mapName: state.metadata.mapName,
    current: focusedCamera(map?.focusCenter),
  }))
  if (camera.mapName !== state.metadata.mapName) {
    setCamera({ mapName: state.metadata.mapName, current: focusedCamera(map?.focusCenter) })
  }

  const [drawings, setDrawings] = React.useState<RoundDrawings>({})
  const [pen, setPen] = React.useState<{ enabled: boolean; color: DrawingColor }>({
    enabled: false,
    color: '#ffffff',
  })
  const [pickerFocusRound, setPickerFocusRound] = React.useState<number>()
  const [selection, setSelection] = React.useState({
    number: round?.number,
    previous: undefined as number | undefined,
  })
  if (selection.number !== round?.number) {
    setSelection({ number: round?.number, previous: selection.number })
  }
  // A new round remounts its controls, so the focused control is found again by its name.
  const stage = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<{ round: number; label: string }>(undefined)
  React.useEffect(() => {
    const pending = refocus.current
    const root = stage.current
    if (!pending || pending.round !== round?.number || !root) return
    refocus.current = undefined
    function restore() {
      const matches = [...root!.querySelectorAll<HTMLElement>('[aria-label]')].filter(
        (element) => element.getAttribute('aria-label') === pending!.label,
      )
      if (!matches.length) return false
      const target =
        matches.find((element) => !element.matches(':disabled')) ??
        root!.querySelector<HTMLElement>('[aria-label^="Choose round"]')
      target?.focus({ preventScroll: true })
      return true
    }
    if (restore()) return
    // The map canvas appears only after the renderer starts.
    const observer = new MutationObserver(() => {
      if (restore()) observer.disconnect()
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [round?.number])

  if (!map) {
    return <></>
  }

  return (
    <div className="demo-content flex min-h-0 flex-1 flex-col px-2 pb-2 opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0 replay-desktop:px-4 replay-desktop:pb-4">
      <div
        ref={stage}
        className="demo-stage relative min-h-0 flex-1 rounded-2xl bg-neutral-900/50 p-3 replay-desktop:overflow-hidden replay-desktop:p-4"
      >
        {round ? (
          <DemoRound
            key={map.name}
            map={map}
            round={round}
            rounds={state.rounds}
            example={example}
            previousRound={selection.previous}
            focusRoundPicker={pickerFocusRound === round.number}
            camera={camera}
            drawings={drawings[round.startTick] ?? emptyFloorDrawings}
            pen={pen}
            onPenChange={setPen}
            onStroke={(floor, stroke) =>
              setDrawings((previous) => {
                const floors = previous[round.startTick] ?? emptyFloorDrawings
                return {
                  ...previous,
                  [round.startTick]: { ...floors, [floor]: [...floors[floor], stroke] },
                }
              })
            }
            onClear={(floor) =>
              setDrawings((previous) => ({
                ...previous,
                [round.startTick]: {
                  ...(previous[round.startTick] ?? emptyFloorDrawings),
                  [floor]: [],
                },
              }))
            }
            onSelectRound={(number, focusPicker = false) => {
              setPickerFocusRound(focusPicker ? number : undefined)
              const focused = document.activeElement
              const label = focused?.getAttribute('aria-label')
              refocus.current =
                !focusPicker && label && stage.current?.contains(focused!)
                  ? { round: number, label }
                  : undefined
              replay.selectRound(number)
            }}
            autoPlay={autoPlay}
            onAutoPlay={onAutoPlay}
          />
        ) : (
          <DemoMap map={map} />
        )}
      </div>
    </div>
  )
}

function DemoRound({
  map,
  example,
  round,
  rounds,
  onSelectRound,
  previousRound,
  focusRoundPicker,
  autoPlay,
  onAutoPlay,
  camera,
  drawings,
  pen,
  onPenChange,
  onStroke,
  onClear,
}: {
  drawings: FloorDrawings
  pen: { enabled: boolean; color: DrawingColor }
  onPenChange(pen: { enabled: boolean; color: DrawingColor }): void
  onStroke(floor: MapFloor, stroke: DrawingStroke): void
  onClear(floor: MapFloor): void
  camera: CameraState
  map: MapDefinition
  example?: ExampleId
  round: ReplayRound
  rounds: readonly ReplayRound[]
  onSelectRound: (number: number, focusPicker?: boolean) => void
  previousRound?: number
  focusRoundPicker: boolean
  autoPlay: boolean
  onAutoPlay: () => void
}) {
  const [playback, setPlayback] = React.useState<DemoPlaybackState>({ status: 'loading' })
  const [cameraState, setCameraState] = React.useState<DemoCameraState>({ status: 'loading' })
  const desktop = React.useSyncExternalStore(
    React.useCallback((notify) => {
      const query = window.matchMedia('(min-width: 1024px) and (min-height: 700px)')
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    }, []),
    () => window.matchMedia('(min-width: 1024px) and (min-height: 700px)').matches,
    () => false,
  )
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const showShortcuts = React.useCallback(() => setShortcutsOpen(true), [])
  const floor =
    playback.status === 'ready'
      ? playback.floor
      : map.floors === 'split'
        ? map.initialFloor
        : 'upper'
  function toggleDrawing() {
    if (desktop) onPenChange({ ...pen, enabled: !pen.enabled })
  }
  useReplayShortcuts({
    playback,
    camera: cameraState,
    map,
    round,
    rounds,
    onSelectRound,
    onShowHelp: showShortcuts,
    onToggleDrawing: toggleDrawing,
    onClearDrawing: () => onClear(floor),
  })
  const [outcome, setOutcome] = React.useState<ReplayRound['outcome'] | null>(null)
  const [highlightNextRound, setHighlightNextRound] = React.useState(false)
  // The round view stays mounted across rounds; a result belongs only to the round that ended.
  const [shownRound, setShownRound] = React.useState(round)
  if (shownRound !== round) {
    setShownRound(round)
    setPlayback({ status: 'loading' })
    setOutcome(null)
    setHighlightNextRound(false)
  }
  const onResult = React.useCallback((result: ReplayRound['outcome'] | null) => {
    setOutcome(result)
    setHighlightNextRound(Boolean(result))
  }, [])

  React.useEffect(() => {
    if (!outcome) return
    const timeout = window.setTimeout(() => setOutcome(null), 2000)
    return () => window.clearTimeout(timeout)
  }, [outcome])

  React.useEffect(() => {
    if (!highlightNextRound) return
    const timeout = window.setTimeout(() => setHighlightNextRound(false), 3000)
    return () => window.clearTimeout(timeout)
  }, [highlightNextRound])

  const { replay } = RootRoute.useRouteContext()
  const playable = playback.status === 'ready'
  React.useEffect(() => {
    if (playable) replay.roundPlayable()
  }, [playable, replay])

  const tick = playback.status === 'ready' ? playback.snapshot.tick : round.liveStartTick
  const started = React.useRef(false)
  const players = playerCardsAtTick(rounds, round, tick)

  React.useEffect(() => {
    if (!autoPlay || started.current || playback.status !== 'ready') return
    started.current = true
    playback.controller.play()
    onAutoPlay()
  }, [autoPlay, playback, onAutoPlay])

  return (
    <div
      data-multifloor={map.floors !== 'single'}
      className="demo-round group/round flex flex-col gap-3 replay-desktop:h-full replay-landscape:grid replay-landscape:grid-cols-[minmax(0,1fr)_auto] replay-landscape:grid-rows-[repeat(3,auto)] replay-landscape:items-start replay-landscape:gap-2"
    >
      <fieldset
        aria-label="Map controls"
        className="demo-map-controls z-20 hidden w-fit max-w-full min-w-0 items-start gap-2 replay-desktop:absolute replay-desktop:top-4 replay-desktop:left-4 replay-desktop:flex replay-landscape:col-start-1 replay-landscape:row-start-2"
      >
        <fieldset
          aria-label="Map navigation"
          className="flex shrink-0 items-center gap-2 replay-desktop:flex-col min-[1728px]:replay-desktop:flex-row"
        >
          <DemoCameraControls camera={cameraState} />
          {map.floors !== 'single' && <DemoFloorControl map={map} playback={playback} />}
        </fieldset>
        <fieldset
          aria-label="Drawing and shortcuts"
          className="flex shrink-0 items-center gap-2 replay-desktop:flex-col min-[1728px]:replay-desktop:flex-row"
        >
          <DemoShortcutHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <DemoDrawingControl
            enabled={pen.enabled}
            count={drawings[floor].length}
            ready={playback.status === 'ready'}
            onToggle={toggleDrawing}
            onClear={() => onClear(floor)}
          />
        </fieldset>
      </fieldset>
      <DemoRoundControl
        desktop={desktop}
        rounds={rounds}
        round={round}
        example={example}
        previousRound={previousRound}
        focusRoundPicker={focusRoundPicker}
        tick={tick}
        highlightNextRound={highlightNextRound}
        onSelectRound={onSelectRound}
        mobileControls={
          !desktop && (
            <>
              <DemoFloorControl map={map} playback={playback} />
              <DemoKillFeedDropdown round={round} tick={tick} />
            </>
          )
        }
      />
      <div className="demo-map-viewport relative aspect-square w-[min(100%,max(240px,70dvh))] self-center replay-desktop:aspect-auto replay-desktop:size-full replay-desktop:min-h-0 replay-landscape:col-start-2 replay-landscape:row-span-3 replay-landscape:row-start-1 replay-landscape:w-[clamp(240px,40vw,70dvh)] replay-landscape:self-start">
        <DemoMap
          map={map}
          round={round}
          camera={camera}
          onCamera={setCameraState}
          onPlayback={setPlayback}
          onResult={onResult}
          drawing={{
            scope: `${round.startTick}:${floor}`,
            enabled: desktop && pen.enabled,
            color: pen.color,
            strokes: drawings[floor],
            onStroke: (stroke) => onStroke(floor, stroke),
          }}
        />
        {outcome && <DemoRoundWin outcome={outcome} />}
      </div>
      <DemoPlaybackControl round={round} playback={playback} />
      <DemoKillFeed round={round} tick={tick} />
      <div className="demo-desktop-players hidden replay-desktop:contents">
        <DemoPlayerCards players={players} presentation="overlay" />
      </div>
      <Collapsible.Root
        className="demo-player-details rounded-2xl bg-neutral-700/25 replay-desktop:hidden replay-landscape:col-start-1 replay-landscape:row-start-3 replay-landscape:w-full"
        aria-label="Player details"
        defaultOpen
      >
        <Collapsible.Trigger className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-3 text-xs font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200">
          Players
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4 in-data-panel-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <DemoPlayerCards players={players} presentation="inline" />
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  )
}
