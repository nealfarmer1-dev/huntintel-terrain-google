function isBlankText(value) {
  return String(value ?? "").trim().length === 0;
}

function isMissingPassword(value) {
  return String(value ?? "").length === 0;
}

export function isPlausibleEmail(value) {
  const email = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function accountSubmissionValidationMessage(mode, values = {}) {
  if (mode === "login" || mode === "forgot") {
    if (isBlankText(values.email)) return "Enter your email address.";
    if (!isPlausibleEmail(values.email)) return "Enter a valid email address.";
  }

  if (mode === "login" && isMissingPassword(values.password)) {
    return "Enter your password.";
  }

  if (mode === "verify" && isBlankText(values.token)) {
    return "Enter your verification token.";
  }

  if (mode === "reset") {
    if (isBlankText(values.token)) return "Enter your reset token.";
    if (isMissingPassword(values.newPassword)) return "Enter a new password.";
    if (isMissingPassword(values.confirmPassword)) return "Confirm your new password.";
    if (values.newPassword !== values.confirmPassword) return "New passwords do not match.";
  }

  return "";
}

export function changePasswordValidationMessage(values = {}) {
  if (isMissingPassword(values.currentPassword)) return "Enter your current password.";
  if (isMissingPassword(values.newPassword)) return "Enter a new password.";
  if (isMissingPassword(values.confirmPassword)) return "Confirm your new password.";
  if (values.newPassword !== values.confirmPassword) return "New passwords do not match.";
  return "";
}
