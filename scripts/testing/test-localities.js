const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { sub: 1, username: 'joe@idreamdevelopers.com', role: 'admin' },
  'majestan_top_secret_key_for_development',
  { expiresIn: '1h' }
);

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/admin/localities',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response Status:', res.statusCode, 'Body:', data));
});

req.write(JSON.stringify({
  data: {
    city_name: "TestCity",
    locality_name: null,
    state_name: "TestState",
    country_name: "India",
    country_code: "IN",
    postal_code: null,
    is_active: 1
  }
}));
req.end();
