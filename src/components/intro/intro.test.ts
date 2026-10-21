import { describe, expect, it } from 'vitest'
import { advanceIntro, teamTag, type IntroEvent, type IntroState } from './intro'

const opening: IntroState = { phase: 'map', mapShown: false, lineupReady: false }
const play = (events: IntroEvent[], from: IntroState = opening) => events.reduce(advanceIntro, from)

describe('advanceIntro', () => {
  it('holds on the map until the map has had its time', () => {
    expect(play(['lineup-ready'])).toEqual({ phase: 'map', mapShown: false, lineupReady: true })
  })

  it('holds on the map until the first round has parsed', () => {
    expect(play(['map-shown'])).toEqual({ phase: 'map', mapShown: true, lineupReady: false })
  })

  it('moves on to the Counter-Terrorists once both have happened, in either order', () => {
    expect(play(['map-shown', 'lineup-ready'])).toEqual({ phase: 'ct' })
    expect(play(['lineup-ready', 'map-shown'])).toEqual({ phase: 'ct' })
  })

  it("doesn't let the map's beat end early", () => {
    expect(play(['beat-shown', 'lineup-ready'])).toEqual({
      phase: 'map',
      mapShown: false,
      lineupReady: true,
    })
  })

  it('plays the beats in order through to the end', () => {
    const phases: string[] = []
    let state = play(['map-shown', 'lineup-ready'])
    while (state.phase !== 'done') {
      phases.push(state.phase)
      state = advanceIntro(state, 'beat-shown')
    }
    expect(phases).toEqual(['ct', 't', 'handoff'])
    expect(advanceIntro(state, 'beat-shown')).toEqual({ phase: 'done' })
  })

  it('ignores the map and round events once past the map', () => {
    expect(play(['map-shown', 'lineup-ready'], { phase: 't' })).toEqual({ phase: 't' })
  })

  it('skips to the end from any beat', () => {
    expect(play(['skip'])).toEqual({ phase: 'done' })
    expect(play(['skip'], { phase: 't' })).toEqual({ phase: 'done' })
    expect(play(['skip'], { phase: 'handoff' })).toEqual({ phase: 'done' })
  })
})

describe('teamTag', () => {
  it('shortens the names teams are known by', () => {
    expect(teamTag('FaZe Clan')).toBe('FAZE')
    expect(teamTag('Natus Vincere')).toBe('NAVI')
    expect(teamTag('Team Spirit')).toBe('SPIRIT')
  })

  it('upper-cases any other name', () => {
    expect(teamTag('Vitality')).toBe('VITALITY')
    expect(teamTag('The MongolZ')).toBe('THE MONGOLZ')
    expect(teamTag('constructor')).toBe('CONSTRUCTOR')
  })
})
