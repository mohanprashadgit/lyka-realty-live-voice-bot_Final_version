const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const child = spawn(edgePath, [
  '--headless',
  '--disable-gpu',
  '--enable-logging=stderr',
  '--v=1',
  '--dump-dom',
  'http://localhost:3000/#crm'
]);

let stdout = '';
let stderr = '';
child.stdout.on('data', d => stdout += d.toString());
child.stderr.on('data', d => stderr += d.toString());

child.on('close', code => {
  console.log('Exit code:', code);
  console.log('STDOUT (length):', stdout.length);
  if (stdout.length < 2000) console.log('STDOUT:', stdout);
  else console.log('STDOUT snippet:', stdout.substring(0, 500), '...', stdout.substring(stdout.length - 500));
  console.log('STDERR:\n', stderr.substring(0, 1000));
});
