const allowedEmails = new Set([
  "joshuajohnr1@gmail.com",
  "annacelestial001@gmail.com",
]);

export function isAllowedMumaaEmail(email: string | undefined) {
  return Boolean(email && allowedEmails.has(email.toLowerCase()));
}
