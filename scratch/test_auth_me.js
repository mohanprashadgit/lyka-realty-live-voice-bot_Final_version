import http from 'http';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/crm/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'CO1', password: '12345678' }),
  });
  const loginData = await loginRes.json();
  console.log('Login result:', loginData);

  const meRes = await fetch('http://localhost:3000/api/crm/auth/me', {
    headers: { 'Authorization': `Bearer ${loginData.token}` },
  });
  const meData = await meRes.json();
  console.log('Me status:', meRes.status, 'Me body:', meData);

  // Chat test
  const chatRes = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello assistant' }],
      language: 'english',
      sessionId: 'test-session-123',
      employeeToken: loginData.token,
    }),
  });
  const chatData = await chatRes.json();
  console.log('Chat status:', chatRes.status, 'Chat body:', chatData);
}

test();
