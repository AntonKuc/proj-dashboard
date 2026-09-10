/**
 * Seeds the database with:
 *  - projects extracted from the source xlsx report (data/raw_extract.json)
 *  - their monthly P&L metrics (as MANUAL/fact data)
 *  - one initial admin user
 *
 * Run with: npm run db:seed
 *
 * The admin password is either read from SEED_ADMIN_PASSWORD (recommended
 * for CI) or randomly generated and printed once to stdout - it is never
 * written to disk or logged anywhere else. Change it after first login.
 */
import { PrismaClient, MetricSource } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const prisma = new PrismaClient();

// Sheet code -> display name. The source file only has short codes;
// rename freely later from the project settings screen (admin only).
const PROJECT_NAMES: Record<string, string> = {
  ИТОГ: "Консолидированный итог",
  UG: "UG",
  ВС: "ВС",
  АП: "АП",
  Tomi: "Tomi",
  ХО: "ХО",
  ТП: "ТП",
  КБ: "КБ",
  БТ: "БТ",
};

type RawRecord = {
  projectCode: string;
  line: string;
  month: string;
  value: number;
};

function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url"); // ~12 chars
}

async function main() {
  const rawPath = path.join(__dirname, "..", "data", "raw_extract.json");
  const records: RawRecord[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));

  const projectCodes = Array.from(new Set(records.map((r) => r.projectCode)));

  const projectIdByCode = new Map<string, string>();
  for (const code of projectCodes) {
    const project = await prisma.project.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: PROJECT_NAMES[code] ?? code,
        isTotal: code === "ИТОГ",
      },
    });
    projectIdByCode.set(code, project.id);
  }

  let count = 0;
  for (const rec of records) {
    const projectId = projectIdByCode.get(rec.projectCode);
    if (!projectId) continue;
    await prisma.metric.upsert({
      where: {
        projectId_line_month_source: {
          projectId,
          line: rec.line,
          month: rec.month,
          source: MetricSource.MANUAL,
        },
      },
      update: { value: rec.value },
      create: {
        projectId,
        line: rec.line,
        month: rec.month,
        value: rec.value,
        source: MetricSource.MANUAL,
      },
    });
    count++;
  }
  console.log(`Seeded ${projectCodes.length} projects and ${count} metric rows.`);

  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { username: adminUsername, passwordHash, role: "ADMIN" },
    });
    console.log("=========================================================");
    console.log(`Created admin user "${adminUsername}"`);
    console.log(`Password: ${password}`);
    console.log("This password is shown only once - store it and change it after first login.");
    console.log("=========================================================");
  } else {
    console.log(`Admin user "${adminUsername}" already exists, skipping.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
