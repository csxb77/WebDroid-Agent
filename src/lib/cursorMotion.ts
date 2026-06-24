/** Edge length, in CSS pixels, of the square cursor container. */
export const CURSOR_SIZE = 24

export interface ViewportSize {
  height: number
  width: number
}

export interface CursorPoint {
  x: number
  y: number
  visible: boolean
  moveSequence?: number
  animateMovement?: boolean
}

export interface CursorMotionInput {
  cursor: CursorPoint | null
  isVisible: boolean
  turnKey: string | null
  viewportSize: ViewportSize
}

export interface CursorFrame {
  arrivedMoveSequence: number | null
  filter: string
  opacity: string
  shouldContinue: boolean
  transform: string
}

type Point = { x: number; y: number }

type BezierSegment = {
  control1: Point
  control2: Point
  end: Point
}

type BezierPath = {
  arc: Point | null
  arcIn: Point | null
  arcOut: Point | null
  end: Point
  endControl: Point
  mode: 'bezier'
  segments: BezierSegment[]
  start: Point
  startControl: Point
}

export type CursorPath =
  | {
      axisRotation: number
      end: Point
      mode: 'scoot'
      rotationTarget: number
      start: Point
    }
  | BezierPath

type Spring = {
  dampingFraction: number
  force: number
  response: number
  scriptTime: number
  simulationTime: number
  target: number
  value: number
  velocity: number
}

type Motion =
  | (Extract<CursorPath, { mode: 'bezier' }> & {
      progressSpring: Spring
    })
  | (Extract<CursorPath, { mode: 'scoot' }> & {
      progressSpring: Spring
    })

interface MotionState {
  arrivedKey: string | null
  cursorKey: string | null
  moveSequence: number | null
  motion: Motion | null
  point: Point
  positionXSpring: Spring
  positionYSpring: Spring
  rotation: number
  rotationSpring: Spring
  scootAxisRotation: number
  scootAxisSpring: Spring
  scootRotationSpring: Spring
  scootStretchSpring: Spring
  stretchSpring: Spring
  visibilitySpring: Spring
  lastTime: number
  thinkStartedAt: number | null
  thinkTurnKey: string | null
}

const HALF_CURSOR_SIZE = CURSOR_SIZE / 2
const CURSOR_CLICK_ANGLE_DEGREES = -44
const DEFAULT_ROTATION = normalizeDegrees(CURSOR_CLICK_ANGLE_DEGREES)
const FALLBACK_X_RATIO = 0.58
const FALLBACK_Y_RATIO = 0.55
const SHORT_MOVE_MAX_DISTANCE = 196
const ARRIVAL_DISTANCE_PX = 0.85
const ARRIVAL_VELOCITY_PX = 12
const FRAME_SECONDS = 1 / 60
const SPRING_STEP_SECONDS = 1 / 240
const MAX_SPRING_CATCHUP_SECONDS = 1
const SPRING_SETTLE_THRESHOLD = 0.001 * 60
const BEZIER_DAMPING_FRACTION = 0.9
const MIN_BEZIER_RESPONSE = 0.12
const MAX_BEZIER_RESPONSE = 2.2
const BEZIER_RESPONSE_SCALE = 0.7
const THINK_DURATION_SECONDS = 1.41
const THINK_PERIOD_SECONDS = 0.66
const THINK_ROTATION_DEGREES = 12.5
const PATH_CONFIG = {
  arcFlow: 0.5783555327868779,
  arcSize: 0.2765523188064277,
  boundsMargin: 20,
  candidateCount: 20,
  clickAngleDegrees: CURSOR_CLICK_ANGLE_DEGREES,
  endpointHandle: 0.15,
  startHandle: 0.41960295031576633,
}
const PATH_SAMPLE_STEPS = 24

const RESPONSE = {
  position: 0.19,
  rotation: 0.12,
  stretch: 0.2,
  visibility: 0.42,
  scoot: 0.19,
  scootRotation: 0.055,
  scootStretch: 0.12,
}

const DAMPING = {
  position: 0.9,
  rotation: 0.9,
  stretch: 0.85,
  visibility: 0.86,
  scoot: 0.94,
  scootRotation: 0.82,
  scootStretch: 0.86,
}

export class CursorMotion {
  private state: MotionState | null = null

  setState(input: CursorMotionInput, now = currentTime()): CursorFrame {
    const turnKey = input.turnKey ?? ''
    const cursor = input.cursor
    const hasCursor = cursor != null
    const target = cursorPoint(cursor, input.viewportSize)
    const visible = input.isVisible && cursor?.visible !== false
    const moveSequence = Number.isInteger(cursor?.moveSequence) ? cursor?.moveSequence ?? null : null
    const cursorKey = moveSequence == null ? null : `${input.turnKey ?? ''}:${moveSequence}`

    if (!this.state) {
      this.state = createMotionState(target, visible, now)
    }

    const state = this.state
    state.lastTime = now
    state.visibilitySpring.target = visible ? 1 : 0

    const isThinkAppear = visible && !hasCursor
    if (isThinkAppear && state.thinkTurnKey !== turnKey) {
      state.thinkTurnKey = turnKey
      resetSpring(state.visibilitySpring, 1)
      state.thinkStartedAt = now
    }

    if (!hasCursor) {
      snapToPoint(state, target)
      return this.renderFrame(null)
    }

    state.thinkStartedAt = null

    state.moveSequence = moveSequence

    const isNewMove = cursorKey !== state.cursorKey
    if (isNewMove) {
      state.cursorKey = cursorKey
      state.arrivedKey = null
      const distance = pointDistance(state.point, target)
      const appeared = visible && state.visibilitySpring.value <= 0.001

      if (cursor!.animateMovement === false || appeared || distance < 0.5) {
        snapToPoint(state, target)
        state.motion = null
        state.arrivedKey = cursorKey
        return this.renderFrame(moveSequence)
      }

      const path = createCursorPath({
        bounds: input.viewportSize,
        end: target,
        start: state.point,
      })
      state.thinkStartedAt = null
      if (path.mode === 'bezier') {
        const response = bezierSpringResponse(path)
        setPositionSpringResponse(state, positionSpringResponse(response.response), response.dampingFraction)
        state.motion = { ...path, progressSpring: spring(0, 1, response.response, response.dampingFraction) }
      } else {
        setPositionSpringResponse(state, RESPONSE.position, DAMPING.position)
        state.motion = { ...path, progressSpring: spring(0, 1, RESPONSE.scoot, DAMPING.scoot) }
      }
    }

    return this.tick(now)
  }

  tick(now = currentTime()): CursorFrame {
    const state = this.state
    if (!state) return emptyFrame()

    const deltaSeconds = Math.max(FRAME_SECONDS, (now - state.lastTime) / 1_000)
    state.lastTime = now

    const arrived = this.step(deltaSeconds)
    return this.renderFrame(arrived)
  }

  private step(deltaSeconds: number): number | null {
    const state = this.state
    if (!state) return null

    let arrivedMoveSequence: number | null = null
    if (state.motion?.mode === 'bezier') {
      const motion = state.motion
      stepSpring(motion.progressSpring, deltaSeconds)
      const progress = clamp(motion.progressSpring.value, 0, 1)
      const sample = sampleBezierPath(motion, progress)
      state.positionXSpring.target = sample.point.x
      state.positionYSpring.target = sample.point.y
      setRotationalTarget(state.rotationSpring, rotationForTangent(sample.tangent))
      state.scootAxisSpring.target = 0
      state.scootStretchSpring.target = 1
      state.scootRotationSpring.target = 0
      state.stretchSpring.target = stretchForSpeed(stepPosition(state, deltaSeconds).speed)
      if (
        progress >= 0.999 &&
        Math.abs(motion.progressSpring.velocity) < 0.01 &&
        pointArrived(state, sample.point)
      ) {
        snapToPoint(state, sample.point)
        state.motion = null
        state.thinkStartedAt = state.lastTime
        arrivedMoveSequence = this.markArrived()
      }
    } else if (state.motion?.mode === 'scoot') {
      const motion = state.motion
      stepSpring(motion.progressSpring, deltaSeconds)
      state.positionXSpring.target = motion.end.x
      state.positionYSpring.target = motion.end.y
      state.rotationSpring.target = DEFAULT_ROTATION
      state.scootAxisSpring.target = motion.axisRotation
      const progress = progressBetween(stepPosition(state, deltaSeconds).point, motion.start, motion.end)
      const wave = Math.sin(clamp(progress, 0, 1) * Math.PI)
      state.scootStretchSpring.target = interpolate(1, interpolate(1, 0, wave), 0.15)
      state.scootRotationSpring.target = motion.rotationTarget * wave
      state.stretchSpring.target = 1
      if (
        progress >= 0.999 &&
        Math.abs(motion.progressSpring.velocity) < 0.01 &&
        pointArrived(state, motion.end)
      ) {
        snapToPoint(state, motion.end)
        resetScoot(state)
        state.motion = null
        state.thinkStartedAt = state.lastTime
        arrivedMoveSequence = this.markArrived()
      }
    } else {
      stepPosition(state, deltaSeconds)
    }

    stepSpring(state.visibilitySpring, deltaSeconds)
    stepSpring(state.stretchSpring, deltaSeconds)
    stepSpring(state.scootStretchSpring, deltaSeconds)
    stepSpring(state.scootRotationSpring, deltaSeconds)

    return arrivedMoveSequence
  }

  private markArrived(): number | null {
    const state = this.state
    if (!state || state.cursorKey == null || state.arrivedKey === state.cursorKey) return null
    state.arrivedKey = state.cursorKey
    return state.moveSequence
  }

  private renderFrame(arrivedMoveSequence: number | null): CursorFrame {
    const state = this.state
    if (!state) return emptyFrame()

    const visibility = clamp(state.visibilitySpring.value, 0, 1)
    const baseScale = interpolate(0.4, 1, visibility)
    const blur = interpolate(5, 0, visibility)
    const scootStretch = clamp(state.scootStretchSpring.value, 0, 1)
    const rotation = currentRotation(state, state.lastTime)
    const transform = [
      'translate3d(' +
        round(state.point.x - HALF_CURSOR_SIZE) +
        'px, ' +
        round(state.point.y - HALF_CURSOR_SIZE) +
        'px, 0)',
    ]

    if (Math.abs(shortestAngle(0, state.scootAxisRotation)) > 0.001 || Math.abs(scootStretch - 1) > 0.001) {
      transform.push(
        'rotate(' + round(state.scootAxisRotation) + 'deg)',
        'scale(1, ' + round(scootStretch) + ')',
        'rotate(' + round(-state.scootAxisRotation) + 'deg)',
      )
    }

    transform.push(
      'rotate(' + round(normalizeDegrees(rotation + state.scootRotationSpring.value)) + 'deg)',
      'scale(' + round(state.stretchSpring.value * baseScale) + ', ' + round(baseScale) + ')',
    )

    return {
      arrivedMoveSequence,
      filter: 'blur(' + round(blur) + 'px)',
      opacity: String(round(visibility)),
      shouldContinue: isMoving(state),
      transform: transform.join(' '),
    }
  }
}

export function createCursorPath(args: {
  bounds: ViewportSize
  end: Point
  start: Point
}): CursorPath {
  if (pointDistance(args.start, args.end) <= SHORT_MOVE_MAX_DISTANCE) {
    const direction = normalizePoint({
      x: args.end.x - args.start.x,
      y: args.end.y - args.start.y,
    })
    return {
      axisRotation:
        pointDistance({ x: 0, y: 0 }, direction) < 0.001
          ? 0
          : (Math.atan2(direction.y, direction.x) * 180) / Math.PI,
      end: args.end,
      mode: 'scoot',
      rotationTarget: clamp(direction.x * 0.75 + -direction.y * 0.62, -1, 1) * 70,
      start: args.start,
    }
  }

  return selectBezierCandidate(buildBezierCandidates(args), args.bounds)
}

function buildBezierCandidates(args: {
  bounds: ViewportSize
  end: Point
  start: Point
}): BezierPath[] {
  const clickTangent = degreesToPoint(PATH_CONFIG.clickAngleDegrees)
  const distance = pointDistance(args.start, args.end)
  const delta = { x: args.end.x - args.start.x, y: args.end.y - args.start.y }
  const travelTangent = normalizePoint(delta)
  const startControlDistance = Math.max(48, Math.min(640, distance * PATH_CONFIG.startHandle, distance * 0.9))
  const endControlDistance = Math.max(48, Math.min(640, distance * PATH_CONFIG.endpointHandle, distance * 0.9))
  const endTangent = { x: -clickTangent.x, y: -clickTangent.y }
  const startControl = advanceWithinBounds(args.bounds, args.start, clickTangent, startControlDistance)
  const endControl = advanceWithinBounds(args.bounds, args.end, endTangent, endControlDistance)
  const normal = { x: -travelTangent.y, y: travelTangent.x }
  const normalSign = normal.x * clickTangent.x + normal.y * clickTangent.y >= 0 ? 1 : -1
  const naturalArcNormal = { x: normal.x * normalSign, y: normal.y * normalSign }
  const midpoint = midpointBetween(args.start, args.end)
  const compactStartControl = advanceWithinBounds(args.bounds, args.start, clickTangent, startControlDistance * 0.65)
  const compactEndControl = advanceWithinBounds(args.bounds, args.end, endTangent, endControlDistance * 0.65)
  const arcDistance = Math.max(50, Math.min(520, distance * PATH_CONFIG.arcSize))
  const arcHandleDistance = Math.max(38, Math.min(440, distance * PATH_CONFIG.arcFlow))
  const arcDistanceScales = [0.55, 0.8, 1.05]
  const arcHandleScales = [0.65, 1, 1.35]
  const candidates = [
    directBezierPath(args.start, args.end, startControl, endControl),
    directBezierPath(args.start, args.end, compactStartControl, compactEndControl),
  ]

  for (const arcDistanceScale of arcDistanceScales) {
    for (const arcHandleScale of arcHandleScales) {
      addArcCandidates({
        arcDistance,
        arcDistanceScale,
        arcHandleDistance,
        arcHandleScale,
        candidates,
        clickTangent,
        end: args.end,
        endControl,
        midpoint,
        naturalArcNormal,
        start: args.start,
        startControl,
        startControlDistance,
        travelTangent,
      })
    }
  }

  return candidates.slice(0, PATH_CONFIG.candidateCount)
}

function addArcCandidates(args: {
  arcDistance: number
  arcDistanceScale: number
  arcHandleDistance: number
  arcHandleScale: number
  candidates: BezierPath[]
  clickTangent: Point
  end: Point
  endControl: Point
  midpoint: Point
  naturalArcNormal: Point
  start: Point
  startControl: Point
  startControlDistance: number
  travelTangent: Point
}): void {
  addArcCandidate({ ...args, arcNormal: args.naturalArcNormal })
  addArcCandidate({
    ...args,
    arcNormal: { x: -args.naturalArcNormal.x, y: -args.naturalArcNormal.y },
  })
}

function addArcCandidate(args: {
  arcDistance: number
  arcDistanceScale: number
  arcHandleDistance: number
  arcHandleScale: number
  arcNormal: Point
  candidates: BezierPath[]
  clickTangent: Point
  end: Point
  endControl: Point
  midpoint: Point
  start: Point
  startControl: Point
  startControlDistance: number
  travelTangent: Point
}): void {
  const arcOffset = args.arcDistance * args.arcDistanceScale
  const arcHandle = args.arcHandleDistance * args.arcHandleScale
  const arc = {
    x: args.midpoint.x + args.arcNormal.x * arcOffset + args.clickTangent.x * args.startControlDistance * 0.16,
    y: args.midpoint.y + args.arcNormal.y * arcOffset + args.clickTangent.y * args.startControlDistance * 0.16,
  }
  const arcIn = {
    x: arc.x - args.travelTangent.x * arcHandle,
    y: arc.y - args.travelTangent.y * arcHandle,
  }
  const arcOut = {
    x: arc.x + args.travelTangent.x * arcHandle,
    y: arc.y + args.travelTangent.y * arcHandle,
  }

  args.candidates.push(
    arcBezierPath({
      arc,
      arcIn,
      arcOut,
      end: args.end,
      endControl: args.endControl,
      start: args.start,
      startControl: args.startControl,
    }),
  )
}

function directBezierPath(start: Point, end: Point, startControl: Point, endControl: Point): BezierPath {
  return {
    arc: null,
    arcIn: null,
    arcOut: null,
    end,
    endControl,
    mode: 'bezier',
    segments: [{ control1: startControl, control2: endControl, end }],
    start,
    startControl,
  }
}

function arcBezierPath(args: {
  arc: Point
  arcIn: Point
  arcOut: Point
  end: Point
  endControl: Point
  start: Point
  startControl: Point
}): BezierPath {
  return {
    arc: args.arc,
    arcIn: args.arcIn,
    arcOut: args.arcOut,
    end: args.end,
    endControl: args.endControl,
    mode: 'bezier',
    segments: [
      { control1: args.startControl, control2: args.arcIn, end: args.arc },
      { control1: args.arcOut, control2: args.endControl, end: args.end },
    ],
    start: args.start,
    startControl: args.startControl,
  }
}

function selectBezierCandidate(candidates: BezierPath[], bounds: ViewportSize): BezierPath {
  const first = candidates[0]
  if (!first) throw new Error('Cursor motion requires at least one candidate')

  let bestInBounds = first
  let bestInBoundsScore = Number.POSITIVE_INFINITY
  let bestOverall = first
  let bestOverallScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const metrics = pathMetrics(candidate, bounds)
    const score = pathScore(candidate, metrics)
    if (score < bestOverallScore) {
      bestOverall = candidate
      bestOverallScore = score
    }
    if (metrics.staysInBounds && score < bestInBoundsScore) {
      bestInBounds = candidate
      bestInBoundsScore = score
    }
  }

  return bestInBoundsScore === Number.POSITIVE_INFINITY ? bestOverall : bestInBounds
}

function pathMetrics(
  path: BezierPath,
  bounds?: ViewportSize,
): {
  angleChangeEnergy: number
  length: number
  maxAngleChange: number
  staysInBounds: boolean
  totalTurn: number
} {
  let length = 0
  let angleChangeEnergy = 0
  let maxAngleChange = 0
  let totalTurn = 0
  let previousAngle: number | null = null
  let segmentStart = path.start
  let previousPoint = path.start
  let staysInBounds = bounds == null || pointInsideBounds(path.start, bounds, PATH_CONFIG.boundsMargin)

  for (const segment of path.segments) {
    for (let step = 1; step <= PATH_SAMPLE_STEPS; step += 1) {
      const point = cubicPoint(segmentStart, segment.control1, segment.control2, segment.end, step / PATH_SAMPLE_STEPS)
      length += pointDistance(previousPoint, point)
      if (bounds) staysInBounds = staysInBounds && pointInsideBounds(point, bounds, PATH_CONFIG.boundsMargin)

      const delta = { x: point.x - previousPoint.x, y: point.y - previousPoint.y }
      if (pointDistance({ x: 0, y: 0 }, delta) > 0.01) {
        const angle = Math.atan2(delta.y, delta.x)
        if (previousAngle != null) {
          const change = angleDeltaRadians(previousAngle, angle)
          angleChangeEnergy += change * change
          maxAngleChange = Math.max(maxAngleChange, Math.abs(change))
          totalTurn += Math.abs(change)
        }
        previousAngle = angle
      }

      previousPoint = point
    }
    segmentStart = segment.end
  }

  return { angleChangeEnergy, length, maxAngleChange, staysInBounds, totalTurn }
}

function pathScore(path: BezierPath, metrics: ReturnType<typeof pathMetrics>): number {
  const directDistance = Math.max(1, pointDistance(path.start, path.end))
  const extraLengthRatio = Math.max(0, metrics.length / directDistance - 1)
  const arcPenalty = path.arc == null ? 0 : 45
  return (
    metrics.length +
    extraLengthRatio * 320 +
    metrics.angleChangeEnergy * 140 +
    metrics.maxAngleChange * 180 +
    metrics.totalTurn * 18 +
    pathStartAlignmentPenalty(path) * 90 +
    arcPenalty
  )
}

function pathStartAlignmentPenalty(path: BezierPath): number {
  const clickTangent = degreesToPoint(PATH_CONFIG.clickAngleDegrees)
  const travelTangent = normalizePoint({ x: path.end.x - path.start.x, y: path.end.y - path.start.y })
  return clamp((-(travelTangent.x * clickTangent.x + travelTangent.y * clickTangent.y) - 0.08) / 0.92, 0, 1)
}

function createMotionState(point: Point, visible: boolean, now: number): MotionState {
  return {
    arrivedKey: null,
    cursorKey: null,
    moveSequence: null,
    motion: null,
    point,
    positionXSpring: spring(point.x, point.x, RESPONSE.position, DAMPING.position),
    positionYSpring: spring(point.y, point.y, RESPONSE.position, DAMPING.position),
    rotation: DEFAULT_ROTATION,
    rotationSpring: spring(DEFAULT_ROTATION, DEFAULT_ROTATION, RESPONSE.rotation, DAMPING.rotation),
    scootAxisRotation: 0,
    scootAxisSpring: spring(0, 0, RESPONSE.rotation, DAMPING.rotation),
    scootRotationSpring: spring(0, 0, RESPONSE.scootRotation, DAMPING.scootRotation),
    scootStretchSpring: spring(1, 1, RESPONSE.scootStretch, DAMPING.scootStretch),
    stretchSpring: spring(1, 1, RESPONSE.stretch, DAMPING.stretch),
    visibilitySpring: spring(visible ? 1 : 0, visible ? 1 : 0, RESPONSE.visibility, DAMPING.visibility),
    lastTime: now,
    thinkStartedAt: null,
    thinkTurnKey: null,
  }
}

function stepPosition(state: MotionState, deltaSeconds: number): { point: Point; speed: number } {
  const previous = state.point
  stepSpring(state.positionXSpring, deltaSeconds)
  stepSpring(state.positionYSpring, deltaSeconds)
  stepSpring(state.rotationSpring, deltaSeconds)
  stepSpring(state.scootAxisSpring, deltaSeconds)
  const point = { x: state.positionXSpring.value, y: state.positionYSpring.value }
  state.point = point
  state.rotation = state.rotationSpring.value
  state.scootAxisRotation = state.scootAxisSpring.value
  return {
    point,
    speed: pointDistance(previous, point) / Math.max(deltaSeconds, SPRING_STEP_SECONDS),
  }
}

function snapToPoint(state: MotionState, point: Point): void {
  state.point = point
  resetSpring(state.positionXSpring, point.x)
  resetSpring(state.positionYSpring, point.y)
  resetSpring(state.rotationSpring, DEFAULT_ROTATION)
  state.rotation = DEFAULT_ROTATION
  resetScoot(state)
  resetSpring(state.stretchSpring, 1)
}

function resetScoot(state: MotionState): void {
  resetSpring(state.scootAxisSpring, 0)
  resetSpring(state.scootRotationSpring, 0)
  resetSpring(state.scootStretchSpring, 1)
  state.scootAxisRotation = 0
}

function pointArrived(state: MotionState, target: Point): boolean {
  return (
    pointDistance(state.point, target) <= ARRIVAL_DISTANCE_PX &&
    Math.abs(state.positionXSpring.velocity) <= ARRIVAL_VELOCITY_PX &&
    Math.abs(state.positionYSpring.velocity) <= ARRIVAL_VELOCITY_PX
  )
}

function isMoving(state: MotionState): boolean {
  return (
    state.motion != null ||
    state.thinkStartedAt != null ||
    !springSettled(state.positionXSpring) ||
    !springSettled(state.positionYSpring) ||
    !springSettled(state.rotationSpring) ||
    !springSettled(state.scootAxisSpring) ||
    !springSettled(state.scootRotationSpring) ||
    !springSettled(state.scootStretchSpring) ||
    !springSettled(state.stretchSpring) ||
    !springSettled(state.visibilitySpring)
  )
}

function sampleBezierPath(
  path: Extract<CursorPath, { mode: 'bezier' }>,
  progress: number,
): { point: Point; tangent: Point } {
  const scaled = progress >= 1 ? path.segments.length - 1 : progress * path.segments.length
  const index = Math.floor(scaled)
  const segment = path.segments[index] ?? path.segments[path.segments.length - 1]
  const previous = index === 0 ? path.start : path.segments[index - 1].end
  const local = progress >= 1 ? 1 : scaled - index
  return {
    point: cubicPoint(previous, segment.control1, segment.control2, segment.end, local),
    tangent: cubicTangent(previous, segment.control1, segment.control2, segment.end, local),
  }
}

function cubicPoint(start: Point, control1: Point, control2: Point, end: Point, t: number): Point {
  const inverse = 1 - t
  return {
    x: start.x * inverse ** 3 + 3 * control1.x * inverse ** 2 * t + 3 * control2.x * inverse * t ** 2 + end.x * t ** 3,
    y: start.y * inverse ** 3 + 3 * control1.y * inverse ** 2 * t + 3 * control2.y * inverse * t ** 2 + end.y * t ** 3,
  }
}

function cubicTangent(start: Point, control1: Point, control2: Point, end: Point, t: number): Point {
  const inverse = 1 - t
  return {
    x: 3 * inverse ** 2 * (control1.x - start.x) + 6 * inverse * t * (control2.x - control1.x) + 3 * t ** 2 * (end.x - control2.x),
    y: 3 * inverse ** 2 * (control1.y - start.y) + 6 * inverse * t * (control2.y - control1.y) + 3 * t ** 2 * (end.y - control2.y),
  }
}

function rotationForTangent(tangent: Point): number {
  if (pointDistance({ x: 0, y: 0 }, tangent) < 0.001) return DEFAULT_ROTATION
  const normalized = normalizePoint(tangent)
  return normalizeDegrees((Math.atan2(normalized.y, normalized.x) * 180) / Math.PI + 90)
}

function stretchForSpeed(speed: number): number {
  return clamp(1 - speed / 5_500, 0.65, 1)
}

function bezierSpringResponse(path: BezierPath): { dampingFraction: number; response: number } {
  return {
    dampingFraction: BEZIER_DAMPING_FRACTION,
    response: pathSpringResponse(path),
  }
}

function pathSpringResponse(path: BezierPath): number {
  const metrics = pathMetrics(path)
  const directDistance = Math.max(1, pointDistance(path.start, path.end))
  const extraLengthRatio = Math.max(0, metrics.length / directDistance - 1)
  const lengthAmount = clamp((metrics.length - 180) / 760, 0, 1)
  const extraLengthAmount = clamp(extraLengthRatio / 0.55, 0, 1)
  const turnAmount = clamp(metrics.totalTurn / (Math.PI * 1.4), 0, 1)
  const angleEnergyAmount = clamp(metrics.angleChangeEnergy / 1.25, 0, 1)
  const complexity = clamp(extraLengthAmount * 0.42 + turnAmount * 0.38 + angleEnergyAmount * 0.2, 0, 1)
  const alignment = pathStartAlignmentPenalty(path) * 0.28
  const arcBonus = path.arc == null ? 0 : 0.04
  const arcMultiplier = path.arc == null ? 1 : 0.9
  return clamp(
    (0.42 + lengthAmount * 0.22 + complexity * 0.12 + alignment + arcBonus) *
      BEZIER_RESPONSE_SCALE *
      arcMultiplier,
    MIN_BEZIER_RESPONSE,
    MAX_BEZIER_RESPONSE,
  )
}

function positionSpringResponse(pathResponse: number): number {
  return clamp(pathResponse * 0.18, 0.035, 0.12)
}

function setPositionSpringResponse(state: MotionState, response: number, dampingFraction: number): void {
  state.positionXSpring.response = response
  state.positionXSpring.dampingFraction = dampingFraction
  state.positionYSpring.response = response
  state.positionYSpring.dampingFraction = dampingFraction
}

function currentRotation(state: MotionState, now: number): number {
  if (state.thinkStartedAt == null) return state.rotation
  const elapsedSeconds = (now - state.thinkStartedAt) / 1_000
  if (elapsedSeconds < 0) return state.rotation

  const progress = Math.min(1, elapsedSeconds / THINK_DURATION_SECONDS)
  const envelope = Math.sin(progress * Math.PI)
  const offset =
    Math.sin((elapsedSeconds / THINK_PERIOD_SECONDS) * Math.PI * 2) * envelope * THINK_ROTATION_DEGREES
  if (progress >= 1) {
    state.thinkStartedAt = null
    return state.rotation
  }
  return state.rotation + offset
}

function spring(value: number, target: number, response: number, dampingFraction: number): Spring {
  return {
    dampingFraction,
    force: 0,
    response,
    scriptTime: 0,
    simulationTime: 0,
    target,
    value,
    velocity: 0,
  }
}

function stepSpring(item: Spring, deltaSeconds: number): void {
  const response = Math.max(0.001, item.response)
  const maxStiffness = 1 / (2 * SPRING_STEP_SECONDS ** 2)
  const stiffness = Math.min((Math.PI * 2) ** 2 / response ** 2, maxStiffness)
  const damping = Math.sqrt(stiffness) * 2 * item.dampingFraction

  item.scriptTime += Math.max(0, deltaSeconds)
  if (item.scriptTime - item.simulationTime > MAX_SPRING_CATCHUP_SECONDS) {
    item.simulationTime = item.scriptTime - FRAME_SECONDS
  }
  while (item.simulationTime < item.scriptTime) {
    integrateSpring(item, stiffness, damping)
    item.simulationTime += SPRING_STEP_SECONDS
  }

  if (springSettled(item)) item.value = item.target
}

function springSettled(item: Spring): boolean {
  if (Math.max(item.velocity * item.velocity, item.force * item.force) > SPRING_SETTLE_THRESHOLD ** 2) {
    return false
  }
  const tolerance = item.target * 0.01
  const delta = item.target - item.value
  return tolerance === 0 || delta * delta <= tolerance * tolerance
}

function integrateSpring(item: Spring, stiffness: number, damping: number): void {
  const halfStep = SPRING_STEP_SECONDS / 2
  const velocity = item.velocity + item.force * halfStep
  item.value += velocity * SPRING_STEP_SECONDS
  item.force = velocity * -damping + (item.target - item.value) * stiffness
  item.velocity = velocity + item.force * halfStep
}

function resetSpring(item: Spring, value: number): void {
  item.force = 0
  item.simulationTime = 0
  item.scriptTime = 0
  item.target = value
  item.value = value
  item.velocity = 0
}

function setRotationalTarget(item: Spring, target: number): void {
  item.target = item.value + shortestAngle(item.value, target)
}

function cursorPoint(cursor: CursorPoint | null, viewportSize: ViewportSize): Point {
  const fallback = {
    x: Math.round(viewportSize.width * FALLBACK_X_RATIO),
    y: Math.round(viewportSize.height * FALLBACK_Y_RATIO),
  }
  return {
    x: clamp(cursor?.x ?? fallback.x, 0, viewportSize.width),
    y: clamp(cursor?.y ?? fallback.y, 0, viewportSize.height),
  }
}

function advanceWithinBounds(bounds: ViewportSize, point: Point, direction: Point, distance: number): Point {
  let usableDistance = distance
  if (direction.x < 0) usableDistance = Math.min(usableDistance, point.x / -direction.x)
  if (direction.x > 0) usableDistance = Math.min(usableDistance, (bounds.width - point.x) / direction.x)
  if (direction.y < 0) usableDistance = Math.min(usableDistance, point.y / -direction.y)
  if (direction.y > 0) usableDistance = Math.min(usableDistance, (bounds.height - point.y) / direction.y)
  return {
    x: point.x + direction.x * Math.max(0, usableDistance),
    y: point.y + direction.y * Math.max(0, usableDistance),
  }
}

function midpointBetween(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function pointInsideBounds(point: Point, bounds: ViewportSize, margin: number): boolean {
  return point.x >= margin && point.x <= bounds.width - margin && point.y >= margin && point.y <= bounds.height - margin
}

function angleDeltaRadians(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

function degreesToPoint(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}

function normalizePoint(point: Point): Point {
  const distance = pointDistance({ x: 0, y: 0 }, point)
  return distance < 0.001 ? { x: 1, y: 0 } : { x: point.x / distance, y: point.y / distance }
}

function progressBetween(point: Point, start: Point, end: Point): number {
  const delta = { x: end.x - start.x, y: end.y - start.y }
  const lengthSquared = delta.x ** 2 + delta.y ** 2
  if (lengthSquared < 0.001) return 1
  return clamp(((point.x - start.x) * delta.x + (point.y - start.y) * delta.y) / lengthSquared, 0, 1)
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function shortestAngle(from: number, to: number): number {
  let delta = to - from
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

function normalizeDegrees(degrees: number): number {
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

function currentTime(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function emptyFrame(): CursorFrame {
  return {
    arrivedMoveSequence: null,
    filter: 'blur(5px)',
    opacity: '0',
    shouldContinue: false,
    transform: 'translate3d(0px, 0px, 0) rotate(' + DEFAULT_ROTATION + 'deg) scale(1, 1)',
  }
}
