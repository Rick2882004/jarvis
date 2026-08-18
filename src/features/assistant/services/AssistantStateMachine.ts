import { AssistantState, AssistantStateListener } from '../types/assistant';

export class AssistantStateMachine {
  private currentState: AssistantState = 'idle';
  private listeners: Set<AssistantStateListener> = new Set();

  public getState(): AssistantState {
    return this.currentState;
  }

  public subscribe(listener: AssistantStateListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public transitionTo(newState: AssistantState): boolean {
    if (this.currentState === newState) return true;

    // Validate legal transitions
    const isValid = this.isValidTransition(this.currentState, newState);

    if (!isValid) {
      console.warn(`[AssistantStateMachine] Invalid transition requested: ${this.currentState} -> ${newState}`);
      return false;
    }

    this.currentState = newState;
    this.notifyListeners();
    return true;
  }

  private isValidTransition(from: AssistantState, to: AssistantState): boolean {
    // Reset to idle or error is always permitted for safety
    if (to === 'idle' || to === 'error') return true;

    switch (from) {
      case 'idle':
        return to === 'listening' || to === 'thinking';
      case 'listening':
        return to === 'thinking' || to === 'idle' || to === 'error';
      case 'thinking':
        return to === 'speaking' || to === 'idle' || to === 'error';
      case 'speaking':
        // Interruption: speaking -> listening is valid!
        return to === 'listening' || to === 'idle' || to === 'error';
      case 'error':
        return to === 'idle' || to === 'listening';
      default:
        return false;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('[AssistantStateMachine] Error in listener callback:', err);
      }
    }
  }
}
