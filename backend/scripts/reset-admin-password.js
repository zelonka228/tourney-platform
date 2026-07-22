// One-off admin utility: sets a password on an account in whatever database
// DATABASE_URL points at. If the username doesn't exist yet, creates it with
// role "admin" (covers "there's no admin account on prod yet" too, not just
// "I forgot the password"). If it exists, only the password (and role, if
// --role is passed) is touched — bio/avatar/createdAt are left alone.
//
// Usage (PowerShell), pointed at the production Postgres via its External
// Database URL from the Render dashboard (tourneyforge-db → Info/Connect),
// with the Prisma Client already generated against schema.production.prisma
// (npm run build does this):
//   $env:DATABASE_URL="<external db url>"
//   node scripts/reset-admin-password.js <username> <new-password> [role]
//
// Password rules mirror backend/src/password.js (register/admin-edit path):
// 8-72 chars, at least one lowercase, one uppercase, one digit, and it can't
// equal the username. [role] defaults to "admin" only when creating a new
// user; an existing user's role is left untouched unless you pass it.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validatePassword(password, username) {
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    throw new Error("Password must be 8-72 characters.");
  }
  if (!/[a-z]/.test(password)) throw new Error("Password needs a lowercase letter.");
  if (!/[A-Z]/.test(password)) throw new Error("Password needs an uppercase letter.");
  if (!/[0-9]/.test(password)) throw new Error("Password needs a digit.");
  if (password.toLowerCase() === username.toLowerCase()) {
    throw new Error("Password can't equal the username.");
  }
}

async function main() {
  const [username, password, role] = process.argv.slice(2);
  if (!username || !password) {
    throw new Error("Usage: node reset-admin-password.js <username> <new-password> [role]");
  }
  if (!USERNAME_RE.test(username)) {
    throw new Error("Username must be 3-20 chars: letters, digits, underscore.");
  }
  validatePassword(password, username);

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { usernameLower: username.toLowerCase() } });

  if (existing) {
    const data = { passwordHash };
    if (role) data.role = role;
    await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`Updated password for existing user "${existing.username}"${role ? ` (role -> ${role})` : ""}.`);
  } else {
    const created = await prisma.user.create({
      data: {
        username,
        usernameLower: username.toLowerCase(),
        passwordHash,
        role: role || "admin",
      },
    });
    console.log(`Created new user "${created.username}" with role "${created.role}".`);
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
