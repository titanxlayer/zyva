import { prisma } from './prisma';

/**
 * Retrieve the user's GitHub OAuth access token from the accounts table.
 * Used for real git push and GitHub API calls.
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'github' },
    select: { access_token: true },
  });
  return account?.access_token ?? null;
}

/** Get the authenticated GitHub user's login + email via the API. */
export async function getGitHubUser(token: string): Promise<{ login: string; name: string; email: string } | null> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const u = await res.json();
    // Fetch primary email if not public
    let email = u.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        email = emails.find((e: any) => e.primary)?.email || emails[0]?.email;
      }
    }
    return { login: u.login, name: u.name || u.login, email: email || `${u.login}@users.noreply.github.com` };
  } catch {
    return null;
  }
}

/** Create a new repo on GitHub (or return existing). Returns the clone URL. */
export async function ensureGitHubRepo(
  token: string,
  repoName: string,
  isPrivate = true,
): Promise<{ ok: boolean; cloneUrl?: string; fullName?: string; error?: string }> {
  try {
    // Check if repo already exists
    const user = await getGitHubUser(token);
    if (!user) return { ok: false, error: 'Could not resolve GitHub user' };

    const existing = await fetch(`https://api.github.com/repos/${user.login}/${repoName}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (existing.ok) {
      const repo = await existing.json();
      return { ok: true, cloneUrl: repo.clone_url, fullName: repo.full_name };
    }

    // Create new repo
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: repoName, private: isPrivate, auto_init: false }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.message || `GitHub API ${res.status}` };
    }
    const repo = await res.json();
    return { ok: true, cloneUrl: repo.clone_url, fullName: repo.full_name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
