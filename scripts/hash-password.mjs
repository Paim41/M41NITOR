import bcrypt from "bcryptjs";
import { stdin, stdout, stderr, exit } from "node:process";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: stdin, output: stdout });

try {
  const password = await rl.question("Administrator password: ");
  if (!password || password.length < 12) {
    throw new Error("Use a password of at least 12 characters.");
  }
  const hash = await bcrypt.hash(password, 12);
  stdout.write(`${hash}\n`);
} catch (error) {
  stderr.write(`${error instanceof Error ? error.message : "Password hashing failed"}\n`);
  exit(1);
} finally {
  rl.close();
}
