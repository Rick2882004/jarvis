export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

export interface IPlatformAdapter {
  isDesktop(): boolean;
  platformName(): 'web' | 'electron' | 'native';
  checkMicrophonePermission(): Promise<PermissionState | 'unsupported'>;
  getAudioInputDevices(): Promise<AudioDeviceInfo[]>;
  supportsSpeechRecognition(): boolean;
  supportsSpeechSynthesis(): boolean;
}
