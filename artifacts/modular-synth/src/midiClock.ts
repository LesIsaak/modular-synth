export interface MidiClockInfo {
  bpm:        number | null;
  deviceName: string | null;
  locked:     boolean;
}

type MidiClockListener = (info: MidiClockInfo) => void;

const _midiClockListeners = new Set<MidiClockListener>();
let _midiClockInfo: MidiClockInfo = { bpm: null, deviceName: null, locked: false };

function _emitClockInfo(patch: Partial<MidiClockInfo>) {
  _midiClockInfo = { ..._midiClockInfo, ...patch };
  _midiClockListeners.forEach(fn => fn(_midiClockInfo));
}

export function emitMidiClockInfo(patch: Partial<MidiClockInfo>) { _emitClockInfo(patch); }
export function setMidiClockLocked(locked: boolean) { _emitClockInfo({ locked }); }
export function getMidiClockInfo() { return _midiClockInfo; }
export function addMidiClockListener(fn: MidiClockListener) { _midiClockListeners.add(fn); }
export function removeMidiClockListener(fn: MidiClockListener) { _midiClockListeners.delete(fn); }
