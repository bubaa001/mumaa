const allowedEmails = new Set([
  "joshuajohnr1@gmail.com",
  "annacelestial001@gmail.com",
]);

export function isAllowedMumaaEmail(email: string | undefined) {
  return Boolean(email && allowedEmails.has(email.toLowerCase()));
}

/** The account owner: the only one who sees and manages investor money on the Trading page. */
export const FOUNDER_EMAIL = "joshuajohnr1@gmail.com";

export function isFounderEmail(email: string | undefined) {
  return Boolean(email && email.toLowerCase() === FOUNDER_EMAIL);
}
