// Small HTTP helpers: async wrapper, typed errors, and a central error handler
// that maps common Prisma errors to sane status codes. Express 4 does not catch
// rejected promises from async route handlers on its own — asyncHandler bridges
// that so every thrown error reaches errorHandler instead of hanging the request.
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap an async route so thrown/rejected errors are forwarded to next().
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Throw HttpError(400) if any of `fields` is missing/blank in `body`.
export function requireFields(body, fields) {
  const src = body ?? {};
  const missing = fields.filter((f) => {
    const v = src[f];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
  if (missing.length > 0) {
    throw new HttpError(400, `Відсутні обов'язкові поля: ${missing.join(", ")}.`);
  }
}

// Throw HttpError(400) if `value` is not one of `allowed`.
export function requireEnum(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `Поле "${field}" має бути одним із: ${allowed.join(", ")}.`);
  }
}

// 404 for unmatched routes.
export function notFound(_req, res) {
  res.status(404).json({ error: "Ресурс не знайдено." });
}

// Central error handler — must be registered last (4-arg signature).
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Запис уже існує (порушення унікальності)." });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Запис не знайдено." });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Посилання на неіснуючий запис (FK)." });
    }
  }
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера." });
}
