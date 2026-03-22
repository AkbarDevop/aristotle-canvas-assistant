import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { AssignmentBrief } from "../types.js";
import { parseAssignmentBrief } from "../pipeline/intake.js";

export async function promptForAssignmentBrief(): Promise<AssignmentBrief> {
  const rl = createInterface({ input, output });

  try {
    console.log("Aristotle intake wizard");
    console.log("Enter the assignment details. Due dates accept YYYY-MM-DD, YYYY-MM-DD HH:mm, or full ISO.");
    console.log("");

    const course = await askRequired(rl, "Course");
    const title = await askRequired(rl, "Assignment title");
    const summary = await askRequired(rl, "Short summary");
    const deliverable = await askRequired(rl, "Deliverable");
    const dueAt = await askRequired(rl, "Due date");
    const effortHours = await askRequired(rl, "Estimated hours");
    const sourceLink = await rl.question("Source link (optional): ");

    const rawAssignment: Partial<AssignmentBrief> = {
      course,
      title,
      summary,
      deliverable,
      dueAt,
      effortHours: Number(effortHours),
    };

    if (sourceLink.trim().length > 0) {
      rawAssignment.sourceLink = sourceLink.trim();
    }

    return parseAssignmentBrief(rawAssignment);
  } finally {
    rl.close();
  }
}

async function askRequired(rl: ReturnType<typeof createInterface>, label: string): Promise<string> {
  while (true) {
    const value = (await rl.question(`${label}: `)).trim();
    if (value.length > 0) {
      return value;
    }

    console.log(`${label} is required.`);
  }
}
