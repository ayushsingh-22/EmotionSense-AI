import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AnalysisHistory,
  UserPreferences,
  TextAnalysisResult,
  VoiceAnalysisResult,
  MultiModalResult,
} from '@/types';

interface AppState {
  // Analysis history
  history: AnalysisHistory[];
  addToHistory: (
    type: 'text' | 'voice' | 'multimodal',
    result: TextAnalysisResult | VoiceAnalysisResult | MultiModalResult
  ) => void;
  clearHistory: () => void;

  // User preferences
  preferences: UserPreferences;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Current analysis
  currentAnalysis: TextAnalysisResult | VoiceAnalysisResult | MultiModalResult | null;
  setCurrentAnalysis: (
    analysis: TextAnalysisResult | VoiceAnalysisResult | MultiModalResult | null
  ) => void;
}

export const useStore = create<AppState>()(
  persist(
    immer((set) => ({
      // History
      history: [],
      addToHistory: (type, result) =>
        set((state) => {
          // Check if this analysis already exists to prevent duplicates
          const existingIndex = state.history.findIndex(
            item => item.type === type && 
            JSON.stringify(item.result) === JSON.stringify(result)
          );
          
          if (existingIndex === -1) {
            state.history.unshift({
              id: `${type}-${Date.now()}-${Math.random()}`,
              type,
              result,
              timestamp: new Date().toISOString(),
            });
            
            // Keep only last 25 analyses for better performance
            if (state.history.length > 25) {
              state.history = state.history.slice(0, 25);
            }
          }
        }),
      clearHistory: () => set((state) => {
        state.history = [];
      }),

      // Preferences
      preferences: {
        theme: 'light',
        defaultMode: 'text',
        voiceEnabled: true,
        ttsEnabled: true,
      },
      updatePreferences: (newPreferences) =>
        set((state) => {
          Object.assign(state.preferences, newPreferences);
        }),

      // UI state
      isLoading: false,
      setIsLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      // Current analysis
      currentAnalysis: null,
      setCurrentAnalysis: (analysis) => set((state) => {
        state.currentAnalysis = analysis;
      }),
    })),
    {
      name: 'emotion-ai-storage',
      partialize: (state) => ({
        history: state.history,
        preferences: state.preferences,
      }),
    }
  )
);
