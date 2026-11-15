// Error codes travel in the URL; only fixed messages are ever shown (no reflected text).
export const MESSAGES: Record<string, string> = {
  bad_code: 'We could not find that circle code and passcode.',
  locked: 'This circle is locked for 15 minutes after too many wrong passcodes.',
  wrong_pass: 'That passcode is not right.',
  slow_down: 'Too many attempts from this device. Wait a few minutes and try again.',
  otp: 'That code is not right, or it has expired. Check the email or ask for a new one.',
  ticket: 'That took too long. Please start again.',
  fields: 'Please fill in the highlighted details.',
  email: 'Please enter a valid email address.',
  pass_weak: 'Choose a passcode that is not easy to guess, like 123456.',
  pass_match: 'The two passcodes do not match.',
  pass_len: 'The passcode must be exactly 6 digits.',
  exists: 'That email already has a request or membership in this circle.',
  photo: 'Use a JPG, PNG or WebP photo under 5 MB.',
  med_none: 'Add at least one dose: morning, afternoon or night.',
  confirm_name: 'Type the name exactly to confirm.',
  denied: 'Only family organisers can do that.',
};
export const msg = (code?: string | string[], n?: string | string[]) => {
  const c = Array.isArray(code) ? code[0] : code;
  if (!c || !MESSAGES[c]) return null;
  const left = Array.isArray(n) ? n[0] : n;
  return c === 'wrong_pass' && left ? `${MESSAGES[c]} ${left} ${left === '1' ? 'try' : 'tries'} left.` : MESSAGES[c];
};
