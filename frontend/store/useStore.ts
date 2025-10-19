import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    (set) => ({
      // History
      history: [],
      addToHistory: (type, result) =>
        set((state) => ({
          history: [
            {
              id: `${type}-${Date.now()}`,
              type,
              result,
              timestamp: new Date().toISOString(),
            },
            ...state.history,
          ].slice(0, 50), // Keep last 50 analyses
        })),
      clearHistory: () => set({ history: [] }),

      // Preferences
      preferences: {
        theme: 'light',
        defaultMode: 'text',
        voiceEnabled: true,
        ttsEnabled: true,
      },
      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),

      // UI state
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Current analysis
      currentAnalysis: null,
      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    }),
    {
      name: 'emotion-ai-storage',
      partialize: (state) => ({
        history: state.history,
        preferences: state.preferences,
      }),
    }
  )
);
