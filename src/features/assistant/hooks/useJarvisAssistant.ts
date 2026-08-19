import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, SessionContext } from '../types/assistant';
import { AssistantStateMachine } from '../services/AssistantStateMachine';
import { SpeechRecognitionAdapter } from '../../voice/services/SpeechRecognitionAdapter';
import { SpeechSynthesisAdapter } from '../../voice/services/SpeechSynthesisAdapter';
import { MockAIProvider } from '../../ai/services/MockAIProvider';
import { OpenAIProvider } from '../../ai/services/OpenAIProvider';
import { GeminiProvider } from '../../ai/services/GeminiProvider';
import { IVoiceInputService, IVoiceOutputService, SpeechVoiceOption } from '../../voice/types/voice';
import { IAIProvider, AIMessage } from '../../ai/types/ai';
import { soundFxService } from '../services/SoundFxService';
import { webPlatformAdapter } from '../../../platform/web/WebPlatformAdapter';

export function useJarvisAssistant() {
  const [stateMachine] = useState(() => new AssistantStateMachine());
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  
  const [voiceInputService] = useState<IVoiceInputService>(() => new SpeechRecognitionAdapter());
  const [voiceOutputService] = useState<IVoiceOutputService>(() => new SpeechSynthesisAdapter());
  const [aiProvider, setAiProvider] = useState<IAIProvider>(() => new GeminiProvider());

  const [session, setSession] = useState<SessionContext>({
    messages: [],
    activeTranscript: '',
    latestResponse: '',
    errorMessage: null,
    audioFeedbackEnabled: true,
    selectedVoiceId: null,
  });

  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [isMicSupported, setIsMicSupported] = useState<boolean>(true);
  const [isTtsSupported, setIsTtsSupported] = useState<boolean>(true);

  // Keep a ref to state to avoid stale closure issues in callbacks
  const stateRef = useRef<AssistantState>(assistantState);
  stateRef.current = assistantState;

  // Initialize and subscribe to state machine
  useEffect(() => {
    const unsubscribe = stateMachine.subscribe((newState) => {
      setAssistantState(newState);
      stateRef.current = newState;
    });

    setIsMicSupported(webPlatformAdapter.supportsSpeechRecognition());
    setIsTtsSupported(webPlatformAdapter.supportsSpeechSynthesis());

    if (voiceOutputService.isSupported()) {
      voiceOutputService.getAvailableVoices().then((vList) => {
        setVoices(vList);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [stateMachine, voiceOutputService]);

  // Handle Voice Input Callbacks
  useEffect(() => {
    voiceInputService.onResult((transcript, isFinal) => {
      setSession((prev) => ({ ...prev, activeTranscript: transcript }));

      if (isFinal && transcript.trim().length > 0) {
        voiceInputService.stopListening();
        processUserQuery(transcript.trim());
      }
    });

    voiceInputService.onError((errorText) => {
      console.warn('[JarvisAssistant] Voice recognition error:', errorText);
      soundFxService.playError();
      stateMachine.transitionTo('error');
      setSession((prev) => ({
        ...prev,
        errorMessage: errorText,
      }));
    });

    voiceInputService.onEnd(() => {
      if (stateRef.current === 'listening') {
        // If listening ended without a transcript (timeout/silence)
        soundFxService.playDeactivate();
        stateMachine.transitionTo('idle');
      }
    });

    return () => {
      voiceInputService.destroy();
    };
  }, [voiceInputService, stateMachine]);

  // Handle Voice Output Callbacks
  useEffect(() => {
    voiceOutputService.onStart(() => {
      // Speech started
    });

    voiceOutputService.onEnd(() => {
      if (stateRef.current === 'speaking') {
        soundFxService.playDeactivate();
        stateMachine.transitionTo('idle');
      }
    });

    voiceOutputService.onError((errorText) => {
      console.warn('[JarvisAssistant] Voice synthesis error:', errorText);
      stateMachine.transitionTo('error');
      setSession((prev) => ({
        ...prev,
        errorMessage: errorText,
      }));
    });

    return () => {
      voiceOutputService.destroy();
    };
  }, [voiceOutputService, stateMachine]);

  // Core processing loop: Query -> AI -> Voice Output
  const processUserQuery = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) {
        stateMachine.transitionTo('idle');
        return;
      }

      // Transition LISTENING -> THINKING
      soundFxService.playThinking();
      const transitioned = stateMachine.transitionTo('thinking');
      if (!transitioned) return;

      const userMessage: AIMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: queryText,
        timestamp: Date.now(),
      };

      const updatedMessages = [...session.messages, userMessage];

      setSession((prev) => ({
        ...prev,
        messages: updatedMessages,
        activeTranscript: queryText,
      }));

      try {
        // AI Abstraction call
        const aiResult = await aiProvider.sendMessage(updatedMessages);

        if (stateRef.current !== 'thinking') {
          // User might have cancelled while thinking
          return;
        }

        const assistantMsg = aiResult.message;
        const responseText = assistantMsg.content;

        setSession((prev) => ({
          ...prev,
          messages: [...updatedMessages, assistantMsg],
          latestResponse: responseText,
        }));

        // Transition THINKING -> SPEAKING
        const canSpeak = stateMachine.transitionTo('speaking');
        if (canSpeak) {
          await voiceOutputService.speak(responseText, {
            voiceId: session.selectedVoiceId || undefined,
          });
        }
      } catch (err: any) {
        console.error('[JarvisAssistant] AI processing failed:', err);
        soundFxService.playError();
        stateMachine.transitionTo('error');
        setSession((prev) => ({
          ...prev,
          errorMessage: err.message || 'Failed to process request with AI core.',
        }));
      }
    },
    [aiProvider, session.messages, session.selectedVoiceId, stateMachine, voiceOutputService]
  );

  // Microphones and Interruption Controller
  const activateMicrophone = useCallback(() => {
    const currentState = stateRef.current;

    // Direct Interruption Handling!
    if (currentState === 'speaking') {
      voiceOutputService.stop(); // Stop speech synthesis immediately
      soundFxService.playActivate();
      setSession((prev) => ({ ...prev, activeTranscript: '' }));
      stateMachine.transitionTo('listening');
      voiceInputService.startListening();
      return;
    }

    if (currentState === 'listening') {
      // Toggle off if already listening
      voiceInputService.stopListening();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
      return;
    }

    if (currentState === 'thinking') {
      // Cancel thinking
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
      return;
    }

    // Standard activation from idle or error
    setSession((prev) => ({ ...prev, activeTranscript: '', errorMessage: null }));
    soundFxService.playActivate();

    const canListen = stateMachine.transitionTo('listening');
    if (canListen) {
      voiceInputService.startListening();
    }
  }, [stateMachine, voiceInputService, voiceOutputService]);

  const deactivateMicrophone = useCallback(() => {
    if (stateRef.current === 'listening') {
      voiceInputService.stopListening();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
    }
  }, [stateMachine, voiceInputService]);

  const interruptSpeaking = useCallback(() => {
    if (stateRef.current === 'speaking') {
      voiceOutputService.stop();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
    }
  }, [stateMachine, voiceOutputService]);

  const resetError = useCallback(() => {
    setSession((prev) => ({ ...prev, errorMessage: null }));
    stateMachine.transitionTo('idle');
  }, [stateMachine]);

  const toggleAudioFeedback = useCallback(() => {
    const nextVal = !session.audioFeedbackEnabled;
    soundFxService.setEnabled(nextVal);
    setSession((prev) => ({ ...prev, audioFeedbackEnabled: nextVal }));
  }, [session.audioFeedbackEnabled]);

  const setVoice = useCallback(
    (voiceId: string) => {
      voiceOutputService.setVoice(voiceId);
      setSession((prev) => ({ ...prev, selectedVoiceId: voiceId }));
    },
    [voiceOutputService]
  );

  const sendTextMessage = useCallback(
    (text: string) => {
      if (stateRef.current === 'speaking') {
        voiceOutputService.stop();
      }
      processUserQuery(text);
    },
    [processUserQuery, voiceOutputService]
  );

  const selectAiProvider = useCallback((providerType: 'gemini' | 'openai' | 'mock') => {
    if (providerType === 'gemini') {
      setAiProvider(new GeminiProvider());
    } else if (providerType === 'openai') {
      setAiProvider(new OpenAIProvider());
    } else {
      setAiProvider(new MockAIProvider());
    }
  }, []);

  return {
    assistantState,
    session,
    activeTranscript: session.activeTranscript,
    latestResponse: session.latestResponse,
    messages: session.messages,
    errorMessage: session.errorMessage,
    voices,
    isMicSupported,
    isTtsSupported,
    audioFeedbackEnabled: session.audioFeedbackEnabled,
    activateMicrophone,
    deactivateMicrophone,
    interruptSpeaking,
    resetError,
    toggleAudioFeedback,
    setVoice,
    sendTextMessage,
    aiProviderName: aiProvider.name,
    selectAiProvider,
    setAiProvider,
  };
}
