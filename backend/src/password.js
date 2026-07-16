// Password complexity rules — shared by registration, admin-driven resets.
// No common-password blocklist (dropped by explicit user request); the
// checks below are the hard, blocking requirements. Recommendations (12+
// chars, a special character) are surfaced client-side only, not enforced.
import { HttpError } from "./http.js";

const MIN_LEN = 8;
const MAX_LEN = 72; // bcrypt truncates/rejects beyond this
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Shared by registration and admin-driven username edits.
export function validateUsername(username) {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    throw new HttpError(
      400,
      "Логін має бути 3–20 символів: латинські літери, цифри або підкреслення."
    );
  }
}

export function validatePassword(password, username) {
  if (typeof password !== "string" || password.length < MIN_LEN || password.length > MAX_LEN) {
    throw new HttpError(400, `Пароль має бути від ${MIN_LEN} до ${MAX_LEN} символів.`);
  }
  if (!/[a-z]/.test(password)) {
    throw new HttpError(400, "Пароль має містити хоча б одну малу літеру.");
  }
  if (!/[A-Z]/.test(password)) {
    throw new HttpError(400, "Пароль має містити хоча б одну велику літеру.");
  }
  if (!/[0-9]/.test(password)) {
    throw new HttpError(400, "Пароль має містити хоча б одну цифру.");
  }
  if (typeof username === "string" && password.toLowerCase() === username.toLowerCase()) {
    throw new HttpError(400, "Пароль не може збігатися з логіном.");
  }
}
