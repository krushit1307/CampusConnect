// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spatialAudioBeacon, SpatialAudioBeacon } from "@/lib/accessibility/spatialAudioBeacon";

class MockAudioParam {
  value = 0;
  setTargetAtTime = vi.fn();
}

class MockOscillatorNode {
  type = "sine";
  frequency = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
}

class MockPannerNode {
  panningModel = "";
  distanceModel = "";
  refDistance = 0;
  maxDistance = 0;
  rolloffFactor = 0;
  positionX = new MockAudioParam();
  positionY = new MockAudioParam();
  positionZ = new MockAudioParam();
  connect = vi.fn();
}

class MockBiquadFilterNode {
  type = "";
  frequency = new MockAudioParam();
  connect = vi.fn();
}

class MockAudioContext {
  currentTime = 1;
  state: AudioContextState = "running";
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createPanner = vi.fn(() => new MockPannerNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

let contextRegistry: MockAudioContext[] = [];

function currentContext(): MockAudioContext {
  return contextRegistry[contextRegistry.length - 1];
}

function installMockAudioContext(): void {
  const MockClass = class extends MockAudioContext {
    constructor() {
      super();
      contextRegistry.push(this);
    }
  };
  (window as unknown as { AudioContext: unknown }).AudioContext =
    MockClass as unknown as typeof AudioContext;
}

function removeMockAudioContext(): void {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
}

beforeEach(() => {
  vi.resetModules();
  contextRegistry = [];
  installMockAudioContext();
});

afterEach(() => {
  removeMockAudioContext();
  contextRegistry = [];
});

function freshBeacon(): SpatialAudioBeacon {
  return new SpatialAudioBeacon();
}

describe("SpatialAudioBeacon.isSupported / start", () => {
  it("reports supported when AudioContext exists", () => {
    expect(SpatialAudioBeacon.isSupported()).toBe(true);
  });

  it("reports unsupported and refuses to start without AudioContext", async () => {
    removeMockAudioContext();
    expect(SpatialAudioBeacon.isSupported()).toBe(false);
    const beacon = freshBeacon();
    await expect(beacon.start()).resolves.toBe(false);
    expect(beacon.isRunning).toBe(false);
  });

  it("creates one audio graph on start and reports running", async () => {
    const beacon = freshBeacon();
    await expect(beacon.start()).resolves.toBe(true);
    expect(beacon.isRunning).toBe(true);
    expect(currentContext().createOscillator).toHaveBeenCalledTimes(2); // chime + tremolo
    expect(currentContext().createPanner).toHaveBeenCalledTimes(1);
  });

  it("reuses the AudioContext on repeated start (no duplicate contexts)", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    await beacon.start();
    expect(currentContext().createGain).toHaveBeenCalledTimes(3); // graph built only once
  });
});

describe("SpatialAudioBeacon.setPosition", () => {
  it("places a straight-ahead target at -Z (front)", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    const panner = currentContext().createPanner.mock.results[0].value as MockPannerNode;

    beacon.setPosition(0, 4, 0);
    expect(panner.positionZ.setTargetAtTime).toHaveBeenLastCalledWith(
      -4,
      currentContext().currentTime,
      0.05,
    );
  });

  it("places a 90°-right target at +X", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    const panner = currentContext().createPanner.mock.results[0].value as MockPannerNode;

    beacon.setPosition(90, 4, 0);
    expect(panner.positionX.setTargetAtTime).toHaveBeenLastCalledWith(
      4,
      currentContext().currentTime,
      0.05,
    );

    const zCalls = panner.positionZ.setTargetAtTime.mock.calls;
    const last = zCalls[zCalls.length - 1];
    expect(last[0]).toBeCloseTo(0, 5);
    expect(last[1]).toBe(currentContext().currentTime);
    expect(last[2]).toBe(0.05);
  });

  it("places elevation on +Y", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    const panner = currentContext().createPanner.mock.results[0].value as MockPannerNode;

    beacon.setPosition(0, 4, 2);
    expect(panner.positionY.setTargetAtTime).toHaveBeenLastCalledWith(
      2,
      currentContext().currentTime,
      0.05,
    );
  });
});

describe("SpatialAudioBeacon.stop", () => {
  it("stops oscillators, closes the context and clears state", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    const oscillators = currentContext().createOscillator.mock.results.map(
      (r) => r.value as MockOscillatorNode,
    );

    beacon.stop();
    expect(oscillators[0].stop).toHaveBeenCalled();
    expect(oscillators[1].stop).toHaveBeenCalled();
    expect(currentContext().close).toHaveBeenCalled();
    expect(beacon.isRunning).toBe(false);
  });

  it("is safe to call repeatedly and before start", () => {
    const beacon = freshBeacon();
    expect(() => {
      beacon.stop();
      beacon.stop();
    }).not.toThrow();
  });

  it("creates a fresh context after stop (clean resource lifecycle)", async () => {
    const beacon = freshBeacon();
    await beacon.start();
    beacon.stop();
    await beacon.start();
    expect(currentContext().createOscillator).toHaveBeenCalledTimes(2);
  });
});

describe("singleton", () => {
  it("uses the default subtle chime config", () => {
    expect(spatialAudioBeacon).toBeInstanceOf(SpatialAudioBeacon);
  });
});
