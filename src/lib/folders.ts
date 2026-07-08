import { prisma } from "./db";

/**
 * Known subjects per semester. Semesters that the student has not reached yet
 * are intentionally left empty — the user organizes those themselves as they
 * progress (add/rename/delete subject folders from the UI).
 */
export const SEMESTER_SUBJECTS: Record<number, string[]> = {
  1: [
    "Fundamentals Of Mathematics For Computer Science",
    "Algorithm And Programming",
    "Computer Architecture",
    "Professional Ethics And Occupational",
    "Fundamentals Of Web Technology",
    "English For General Communication",
    "Islamic Studies",
    "Community Services",
    "Integrity And Anti-Corruption",
  ],
  2: [
    "Data Structure",
    "System Analysis And Design",
    "Creativity And Innovation",
    "Web Design",
    "Dotnet Programming",
    "Japanese Communication 1",
    "Umrah And Hajj (Pilgrimage And Hajj)",
    "Philosophy And Current Issues",
  ],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
};

export const TOTAL_SEMESTERS = 7;
export const SUBJECT_SUBFOLDERS = ["Learning Materials", "Lab", "Project"] as const;

export const SYSTEM_ROOT_FOLDERS = ["Technology Web", "Project", "Private Content"] as const;

/** Root-level folder names that cannot be deleted from the UI. */
export function isProtectedRootFolder(name: string, parentId: string | null) {
  return parentId === null && (SYSTEM_ROOT_FOLDERS as readonly string[]).includes(name);
}

async function findOrCreateFolder(ownerId: string, name: string, parentId: string | null) {
  const existing = await prisma.folder.findFirst({ where: { ownerId, name, parentId } });
  if (existing) return existing;
  return prisma.folder.create({ data: { ownerId, name, parentId } });
}

/**
 * Idempotently makes sure the fixed system folders exist for a given owner:
 * - "Technology Web" > "Semester 1..7" > (known subjects) > Learning Materials / Lab / Project
 * - "Project" (flat, no sub-folders)
 * - "Private Content" (flat, passcode gated client-side)
 */
export async function ensureSystemFolders(ownerId: string) {
  const project = await findOrCreateFolder(ownerId, "Project", null);
  const privateContent = await findOrCreateFolder(ownerId, "Private Content", null);
  const technologyWeb = await findOrCreateFolder(ownerId, "Technology Web", null);

  for (let semester = 1; semester <= TOTAL_SEMESTERS; semester += 1) {
    const semesterFolder = await findOrCreateFolder(ownerId, `Semester ${semester}`, technologyWeb.id);
    const subjects = SEMESTER_SUBJECTS[semester] ?? [];
    for (const subject of subjects) {
      const subjectFolder = await findOrCreateFolder(ownerId, subject, semesterFolder.id);
      for (const sub of SUBJECT_SUBFOLDERS) {
        await findOrCreateFolder(ownerId, sub, subjectFolder.id);
      }
    }
  }

  return { technologyWeb, project, privateContent };
}

export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export async function listAllFolders(ownerId: string): Promise<FolderNode[]> {
  const folders = await prisma.folder.findMany({
    where: { ownerId },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.createdAt.toISOString(),
  }));
}

/** Collect a folder id plus every nested descendant id (for cascading delete). */
export async function collectDescendantIds(ownerId: string, rootId: string): Promise<string[]> {
  const all = await prisma.folder.findMany({ where: { ownerId }, select: { id: true, parentId: true } });
  const byParent = new Map<string, string[]>();
  for (const folder of all) {
    if (!folder.parentId) continue;
    byParent.set(folder.parentId, [...(byParent.get(folder.parentId) ?? []), folder.id]);
  }
  const collected: string[] = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of byParent.get(current) ?? []) {
      collected.push(child);
      queue.push(child);
    }
  }
  return collected;
}
