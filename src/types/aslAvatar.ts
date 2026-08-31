export interface VttCaptionSegment {
  id: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  text: string;
  speakerLabel?: string;
}

export type AslHandShape = 'open_palm' | 'fist' | 'index_point' | 'peace_sign' | 'thumbs_up' | 'c_shape';

export interface SkeletalBoneRotation {
  boneName: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface AslAnimationFrame {
  timestampMs: number;
  handShapeLeft: AslHandShape;
  handShapeRight: AslHandShape;
  leftArmRotations: SkeletalBoneRotation[];
  rightArmRotations: SkeletalBoneRotation[];
  facialExpression: 'neutral' | 'questioning' | 'emphatic' | 'nodding';
}

export interface AslGlossToken {
  token: string;
  aslSign: string;
  startTimeSeconds: number;
  durationSeconds: number;
  animationKeyframes: AslAnimationFrame[];
}

export interface AslTranslationOutput {
  vttSegmentId: string;
  sourceText: string;
  aslGrammarGloss: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  glossTokens: AslGlossToken[];
}

export interface AvatarPlaybackState {
  currentGlossIndex: number;
  activeSegmentId?: string;
  isAvatarActive: boolean;
  avatarScale: number;
  playbackRate: number;
}
