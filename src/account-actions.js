function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function createAccountActionGuard() {
  return { current: false };
}

export async function runSignOutAction({ guard, clearSession, onSignedOut, setBusy, setMessage }) {
  if (guard.current) return { status: "ignored" };
  guard.current = true;
  setBusy(true);
  setMessage("");
  try {
    await clearSession();
    await onSignedOut();
    return { status: "success" };
  } catch (error) {
    setMessage(errorMessage(error, "Unable to sign out. Your session is still active; please try again."));
    return { status: "failure", error };
  } finally {
    guard.current = false;
    setBusy(false);
  }
}

export async function runDeleteAccountAction({ guard, deleteAccount, clearSession, onSignedOut, setBusy, setMessage }) {
  if (guard.current) return { status: "ignored" };
  guard.current = true;
  setBusy(true);
  setMessage("");
  try {
    await deleteAccount();
    await clearSession();
    await onSignedOut();
    return { status: "success" };
  } catch (error) {
    setMessage(errorMessage(error, "Unable to delete your account. You remain signed in; please try again."));
    return { status: "failure", error };
  } finally {
    guard.current = false;
    setBusy(false);
  }
}
