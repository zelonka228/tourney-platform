// Mirrors backend/src/password.js — same hard requirements, checked
// client-side for instant feedback (the backend re-validates regardless).
const MIN_LEN = 8;
const MAX_LEN = 72;

export function validatePassword(password, username) {
  const errors = [];
  if (!password || password.length < MIN_LEN || password.length > MAX_LEN) {
    errors.push(`Довжина від ${MIN_LEN} до ${MAX_LEN} символів`);
  }
  if (!/[a-z]/.test(password)) errors.push("Хоча б одна мала літера");
  if (!/[A-Z]/.test(password)) errors.push("Хоча б одна велика літера");
  if (!/[0-9]/.test(password)) errors.push("Хоча б одна цифра");
  if (username && password && password.toLowerCase() === username.toLowerCase()) {
    errors.push("Не збігається з логіном");
  }
  return { valid: errors.length === 0, errors };
}

// 0..3 — рахунок для індикатора складності (не блокує, лише рекомендація).
export function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (variety >= 3) score++;
  if (variety >= 4) score++;
  return Math.min(score, 3);
}
