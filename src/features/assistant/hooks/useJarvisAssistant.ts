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
import { SpeechChunker } from '../services/SpeechChunker';
import { SpeechQueue } from '../services/SpeechQueue';

export function useJarvisAssistant() {
  const [stateMachine] = useState(() => new AssistantStateMachine());
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');

  const [voiceInputService] = useState<IVoiceInputService>(() => new SpeechRecognitionAdapter());
  const [voiceOutputService] = useState<IVoiceOutputService>(() => new SpeechSynthesisAdapter());
  const [aiProvider, setAiProvider] = useState<IAIProvider>(() => new GeminiProvider());

  const [speechQueue] = useState(() => new SpeechQueue(voiceOutputService));
  const speechChunkerRef = useRef<SpeechChunker>(new SpeechChunker());
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Initialize and subscribe to state machine & speech queue
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

    speechQueue.onStart(() => {
      if (stateRef.current === 'thinking' || stateRef.current === 'idle') {
        stateMachine.transitionTo('speaking');
      }
    });

    speechQueue.onEmpty(() => {
      if (stateRef.current === 'speaking' && !abortControllerRef.current) {
        soundFxService.playDeactivate();
        stateMachine.transitionTo('idle');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [stateMachine, voiceOutputService, speechQueue]);

  // Cancel any active stream or ongoing speech
  const cancelActiveOperations = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    speechQueue.cancel();
    speechChunkerRef.current.reset();
  }, [speechQueue]);

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
        soundFxService.playDeactivate();
        stateMachine.transitionTo('idle');
      }
    });

    return () => {
      voiceInputService.destroy();
    };
  }, [voiceInputService, stateMachine]);

  // Core processing loop: Query -> AI Stream -> Speech Queue
  const processUserQuery = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) {
        stateMachine.transitionTo('idle');
        return;
      }

      // Cancel any ongoing operations before starting new query
      cancelActiveOperations();

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
        latestResponse: '',
      }));

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestStartedAt = Date.now();
      let firstChunkAt: number | null = null;
      let firstSpeechAt: number | null = null;

      console.log('[Jarvis] request started');

      speechQueue.onStart(() => {
        if (stateRef.current === 'thinking' || stateRef.current === 'idle') {
          stateMachine.transitionTo('speaking');
        }
        if (!firstSpeechAt) {
          firstSpeechAt = Date.now();
          console.log(`[Jarvis] first speech: ${firstSpeechAt - requestStartedAt}ms`);
        }
      });

      speechQueue.setOptions({
        voiceId: session.selectedVoiceId || undefined,
      });
      speechChunkerRef.current.reset();

      let liveAccumulatedText = '';

      try {
        const aiResult = await aiProvider.sendMessage(updatedMessages, {
          signal: controller.signal,
          onChunk: (chunkText) => {
            if (controller.signal.aborted) return;

            if (!firstChunkAt) {
              firstChunkAt = Date.now();
              console.log(`[Jarvis] first chunk: ${firstChunkAt - requestStartedAt}ms`);
            }

            liveAccumulatedText += chunkText;

            // Extract completed sentence segments
            const segments = speechChunkerRef.current.addChunk(chunkText);
            if (segments.length > 0) {
              speechQueue.enqueue(segments);
            }

            setSession((prev) => ({
              ...prev,
              latestResponse: liveAccumulatedText,
            }));
          },
        });

        if (controller.signal.aborted) {
          return;
        }

        const streamCompletedAt = Date.now();
        console.log(`[Jarvis] stream complete: ${streamCompletedAt - requestStartedAt}ms`);

        // Flush any remaining text in chunker buffer into speech queue
        const remainingSegments = speechChunkerRef.current.flush();
        if (remainingSegments.length > 0) {
          speechQueue.enqueue(remainingSegments);
        }

        const assistantMsg = aiResult.message;
        const fullResponseText = assistantMsg.content || liveAccumulatedText;

        // Store complete assistant message in session history for context preservation
        setSession((prev) => ({
          ...prev,
          messages: [...updatedMessages, { ...assistantMsg, content: fullResponseText }],
          latestResponse: fullResponseText,
        }));

        abortControllerRef.current = null;

        // If speech queue finished or is empty, transition to idle
        if (!speechQueue.isBusy() && stateRef.current === 'speaking') {
          soundFxService.playDeactivate();
          stateMachine.transitionTo('idle');
        }
      } catch (err: any) {
        if (controller.signal.aborted) {
          return; // Suppress cancelled abort errors
        }

        console.error('[JarvisAssistant] AI processing failed:', err);
        cancelActiveOperations();
        soundFxService.playError();
        stateMachine.transitionTo('error');
        setSession((prev) => ({
          ...prev,
          errorMessage: err.message || 'Failed to process request with AI core.',
        }));
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [aiProvider, session.messages, session.selectedVoiceId, stateMachine, speechQueue, cancelActiveOperations]
  );

  // Microphones and Interruption Controller
  const activateMicrophone = useCallback(() => {
    const currentState = stateRef.current;

    // Direct Interruption Handling!
    if (currentState === 'speaking' || currentState === 'thinking') {
      cancelActiveOperations();
      soundFxService.playActivate();
      setSession((prev) => ({ ...prev, activeTranscript: '' }));
      stateMachine.transitionTo('listening');
      voiceInputService.startListening();
      return;
    }

    if (currentState === 'listening') {
      voiceInputService.stopListening();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
      return;
    }

    // Standard activation from idle or error
    cancelActiveOperations();
    setSession((prev) => ({ ...prev, activeTranscript: '', errorMessage: null }));
    soundFxService.playActivate();

    const canListen = stateMachine.transitionTo('listening');
    if (canListen) {
      voiceInputService.startListening();
    }
  }, [stateMachine, voiceInputService, cancelActiveOperations]);

  const deactivateMicrophone = useCallback(() => {
    if (stateRef.current === 'listening') {
      voiceInputService.stopListening();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
    }
  }, [stateMachine, voiceInputService]);

  const interruptSpeaking = useCallback(() => {
    if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
      cancelActiveOperations();
      soundFxService.playDeactivate();
      stateMachine.transitionTo('idle');
    }
  }, [stateMachine, cancelActiveOperations]);

  const resetError = useCallback(() => {
    cancelActiveOperations();
    setSession((prev) => ({ ...prev, errorMessage: null }));
    stateMachine.transitionTo('idle');
  }, [stateMachine, cancelActiveOperations]);

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
      cancelActiveOperations();
      processUserQuery(text);
    },
    [processUserQuery, cancelActiveOperations]
  );

  const selectAiProvider = useCallback(
    (providerType: 'gemini' | 'openai' | 'mock') => {
      cancelActiveOperations();
      if (providerType === 'gemini') {
        setAiProvider(new GeminiProvider());
      } else if (providerType === 'openai') {
        setAiProvider(new OpenAIProvider());
      } else {
        setAiProvider(new MockAIProvider());
      }
    },
    [cancelActiveOperations]
  );

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
