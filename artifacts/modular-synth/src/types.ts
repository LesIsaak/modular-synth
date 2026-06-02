export type PortType = 'audio_out' | 'audio_in' | 'cv_out' | 'cv_in' | 'gate_out' | 'gate_in';
export type ModuleCategory =
  | 'oscillator' | 'filter' | 'amplifier' | 'dynamics'
  | 'envelope' | 'lfo' | 'sequencer' | 'clock'
  | 'delay' | 'reverb' | 'modulation' | 'distortion'
  | 'spectral' | 'granular' | 'utility';

export interface PortDef {
  id: string;
  name: string;
  type: PortType;
}

export interface KnobDef {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  log?: boolean;
  unit?: string;
  step?: number;
}

export interface SelectorDef {
  id: string;
  name: string;
  options: string[];
  default: number;
}

export interface ModuleTypeDef {
  id: string;
  name: string;
  category: ModuleCategory;
  accentColor: string;
  width: number;
  knobs: KnobDef[];
  selectors?: SelectorDef[];
  ports: PortDef[];
}

export interface ModuleInstance {
  id: string;
  typeId: string;
  x: number;
  y: number;
  params: Record<string, number>;
}

export interface Cable {
  id: string;
  fromModuleId: string;
  fromPortId: string;
  toModuleId: string;
  toPortId: string;
  color: string;
}

export interface PendingCable {
  fromModuleId: string;
  fromPortId: string;
  fromPortType: PortType;
}
