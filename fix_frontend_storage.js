// Fix Frontend Storage - Run this in browser console
// This will clear corrupted Zustand localStorage data

console.log("🔧 Fixing frontend storage issues...");

try {
  // Check current localStorage
  const currentStorage = localStorage.getItem('emotion-ai-storage');
  console.log("📊 Current storage:", currentStorage);
  
  if (currentStorage) {
    try {
      JSON.parse(currentStorage);
      console.log("✅ Storage is valid JSON");
    } catch (e) {
      console.log("❌ Storage is corrupted, clearing...");
      localStorage.removeItem('emotion-ai-storage');
      console.log("✅ Corrupted storage cleared");
    }
  }
  
  // Clear all emotion-ai related storage
  Object.keys(localStorage).forEach(key => {
    if (key.includes('emotion') || key.includes('ai') || key.includes('chat')) {
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared: ${key}`);
    }
  });
  
  // Set fresh default state
  const defaultState = {
    state: {
      history: [],
      preferences: {
        theme: 'light',
        defaultMode: 'text',
        voiceEnabled: true,
        ttsEnabled: true,
      }
    },
    version: 0
  };
  
  localStorage.setItem('emotion-ai-storage', JSON.stringify(defaultState));
  console.log("✅ Fresh storage state initialized");
  
  console.log("🎉 Frontend storage fixed! Please refresh the page.");
  
} catch (error) {
  console.error("❌ Error fixing storage:", error);
}