// Single shared PrismaClient instance for the whole backend.
// Import as: import prisma from "./db.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
export { prisma };
