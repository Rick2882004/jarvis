import { IPlatformAdapter, AudioDeviceInfo } from '../types/platform';
import { IWindowWithSpeechRecognition } from '../../features/voice/types/voice';

export class WebPlatformAdapter implements IPlatformAdapter {
  isDesktop(): boolean {
    return false;
  }

  platformName(): 'web' | 'electron' | 'native' {
    return 'web';
  }

  async checkMicrophonePermission(): Promise<PermissionState | 'unsupported'> {
    if (!navigator.permissions || !navigator.permissions.query) {
      return 'unsupported';
    }
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permissionStatus.state;
    } catch {
      return 'unsupported';
    }
  }

  async getAudioInputDevices(): Promise<AudioDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
        }));
    } catch {
      return [];
    }
  }

  supportsSpeechRecognition(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindowWithSpeechRecognition;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  supportsSpeechSynthesis(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }
}

export const webPlatformAdapter = new WebPlatformAdapter();
