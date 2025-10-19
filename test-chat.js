// Test script for the new chat endpoint
const testChatEndpoint = async () => {
  try {
    const response = await fetch('http://localhost:8080/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Today I feel sad 😔',
        userId: 'test-user'
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
};

testChatEndpoint();