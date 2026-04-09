import type { User } from "../types/api";

export function sortHomeUsers(users: User[], currentUserId: number | null): User[] {
  return [...users].sort((left, right) => {
    if (currentUserId !== null) {
      const leftIsCurrent = left.id === currentUserId;
      const rightIsCurrent = right.id === currentUserId;

      if (leftIsCurrent && !rightIsCurrent) return -1;
      if (!leftIsCurrent && rightIsCurrent) return 1;
    }

    return left.username.localeCompare(right.username, undefined, { sensitivity: "base" });
  });
}
