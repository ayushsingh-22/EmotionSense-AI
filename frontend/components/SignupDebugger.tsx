// Debug utility to test signup process
// Add this to the bottom of your signup page to debug the issue

export function SignupDebugger() {
  const testSignup = async () => {
    const testData = {
      email: 'test.user@gmail.com',
      password: 'testpass123',
      fullName: 'Test User'
    };

    console.log('Testing signup with:', testData);
    
    try {
      const response = await fetch('/api/test-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });
      
      const result = await response.json();
      console.log('Test signup result:', result);
    } catch (error) {
      console.error('Test signup error:', error);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h4>Debug Tools</h4>
      <button onClick={testSignup} className="px-4 py-2 bg-blue-500 text-white rounded">
        Test Signup Process
      </button>
    </div>
  );
}