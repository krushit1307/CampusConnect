import {
  AslAnimationFrame,
  AslGlossToken,
  AslHandShape,
  AslTranslationOutput,
  VttCaptionSegment,
} from '../types/aslAvatar';

// English to ASL Gloss structural dictionary map
const ENGLISH_TO_ASL_GLOSS_MAP: Record<string, string> = {
  welcome: 'WELCOME',
  campus: 'CAMPUS',
  connect: 'CONNECT',
  event: 'EVENT',
  today: 'TODAY',
  student: 'STUDENT',
  pizza: 'PIZZA',
  party: 'PARTY',
  hall: 'HALL',
  speech: 'SPEECH',
  speaker: 'SPEAKER',
  hello: 'HELLO',
  good: 'GOOD',
  morning: 'MORNING',
  afternoon: 'AFTERNOON',
  thank: 'THANK-YOU',
  you: 'YOU',
  help: 'HELP',
  need: 'NEED',
  accessibility: 'ACCESSIBILITY',
};

/**
 * Translates standard English text into ASL Subject-Object-Verb / Topic-Comment gloss structure.
 */
export function translateTextToAslGloss(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const glosses: string[] = [];

  for (const word of words) {
    if (ENGLISH_TO_ASL_GLOSS_MAP[word]) {
      glosses.push(ENGLISH_TO_ASL_GLOSS_MAP[word]);
    } else {
      // Fingerspell unknown words
      const fingerspelled = word
        .toUpperCase()
        .split('')
        .join('-');
      glosses.push(fingerspelled);
    }
  }

  return glosses.join(' ');
}

/**
 * Generates synthetic 3D skeletal keyframe animation sequences (BVH mock data) for a given ASL gloss.
 */
export function generateAslAnimationKeyframes(
  gloss: string,
  startTime: number,
  duration: number
): AslAnimationFrame[] {
  const frames: AslAnimationFrame[] = [];
  const totalFrames = 15; // 15 keyframes per gloss token
  const stepMs = (duration * 1000) / totalFrames;

  let handShape: AslHandShape = 'open_palm';
  if (gloss.includes('HELLO') || gloss.includes('WELCOME')) handShape = 'open_palm';
  else if (gloss.includes('THANK')) handShape = 'open_palm';
  else if (gloss.includes('PIZZA')) handShape = 'c_shape';
  else handShape = 'index_point';

  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames;
    const angleX = Math.sin(progress * Math.PI) * 0.8;
    const angleY = Math.cos(progress * Math.PI) * 0.5;

    frames.push({
      timestampMs: startTime * 1000 + i * stepMs,
      handShapeLeft: handShape,
      handShapeRight: handShape,
      leftArmRotations: [
        { boneName: 'UpperArm_L', rotationX: angleX, rotationY: angleY, rotationZ: 0.2 },
        { boneName: 'LowerArm_L', rotationX: angleX * 0.5, rotationY: 0.1, rotationZ: 0.1 },
      ],
      rightArmRotations: [
        { boneName: 'UpperArm_R', rotationX: -angleX, rotationY: -angleY, rotationZ: -0.2 },
        { boneName: 'LowerArm_R', rotationX: -angleX * 0.5, rotationY: -0.1, rotationZ: -0.1 },
      ],
      facialExpression: gloss.includes('?') ? 'questioning' : 'neutral',
    });
  }

  return frames;
}

/**
 * Parses VTT transcript caption segments and converts them into time-synced ASL animation structures.
 */
export function processVttToAslTranslation(
  segment: VttCaptionSegment
): AslTranslationOutput {
  const aslGlossText = translateTextToAslGloss(segment.text);
  const glossTokensList = aslGlossText.split(' ');

  const totalDuration = segment.endTimeSeconds - segment.startTimeSeconds;
  const tokenDuration = totalDuration / Math.max(1, glossTokensList.length);

  const glossTokens: AslGlossToken[] = glossTokensList.map((token, index) => {
    const tokenStart = segment.startTimeSeconds + index * tokenDuration;
    return {
      token,
      aslSign: token,
      startTimeSeconds: tokenStart,
      durationSeconds: tokenDuration,
      animationKeyframes: generateAslAnimationKeyframes(token, tokenStart, tokenDuration),
    };
  });

  return {
    vttSegmentId: segment.id,
    sourceText: segment.text,
    aslGrammarGloss: aslGlossText,
    startTimeSeconds: segment.startTimeSeconds,
    endTimeSeconds: segment.endTimeSeconds,
    glossTokens,
  };
}

/**
 * Sync engine: given video player currentTime in seconds, returns the active keyframe to render on WebGL avatar.
 */
export function getActiveAslKeyframeAtTime(
  translations: AslTranslationOutput[],
  currentTimeSeconds: number
): { activeSegment?: AslTranslationOutput; activeKeyframe?: AslAnimationFrame } {
  const currentSegment = translations.find(
    (t) => currentTimeSeconds >= t.startTimeSeconds && currentTimeSeconds <= t.endTimeSeconds
  );

  if (!currentSegment) {
    return {};
  }

  const currentMs = currentTimeSeconds * 1000;
  for (const token of currentSegment.glossTokens) {
    const keyframe = token.animationKeyframes.find(
      (kf, idx) => {
        const nextKf = token.animationKeyframes[idx + 1];
        if (!nextKf) return currentMs >= kf.timestampMs;
        return currentMs >= kf.timestampMs && currentMs < nextKf.timestampMs;
      }
    );
    if (keyframe) {
      return { activeSegment: currentSegment, activeKeyframe: keyframe };
    }
  }

  return { activeSegment: currentSegment };
}
