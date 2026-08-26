export function assertAdminRole(role: string | null | undefined): asserts role is "admin" {
  if (role !== "admin") {
    throw new Error("Forbidden");
  }
}
