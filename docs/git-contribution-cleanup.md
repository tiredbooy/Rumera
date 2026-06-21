# How to Remove a Contributor from Your Repo

A step-by-step guide to making **one person/account the only contributor** in a
Git repository's history — by re-attributing old commits and removing
co-author credits. No prior Git-internals knowledge needed; just copy, paste,
and replace the names.

> **Real example (this repo):** everything was consolidated under
> **`tiredbooy <mahdykazemyo1i2@gmail.com>`**, dropping a second personal account
> and some AI "co-author" credits.

---

## ⚠️ Read this first

This **rewrites your Git history**. That means:

- **Every commit gets a new ID**, so you must **force-push** at the end.
- It's **permanent** on GitHub once pushed. Step 1 below makes a backup first.
- **Anyone else who has the repo cloned** will need to delete and re-clone it
  afterward (their old copy no longer matches).

If you're the only person working on the repo, this is perfectly safe — just
follow the steps in order.

---

## What makes someone show up as a "contributor"?

GitHub looks at **two** places. We clean both:

| # | What | Where it lives |
|---|------|----------------|
| 1 | **Author / committer** | the name + email on each commit |
| 2 | **`Co-Authored-By:` lines** | extra credit lines inside the commit *message* |

A name only becomes a clickable contributor if its **email is verified on a
GitHub account**. Other emails (like `noreply@anthropic.com`) still appear in the
text, so we remove them too.

---

## Before you start

Open a terminal in your repo and run these to see what you're dealing with:

```bash
# Who is in the history (names + emails)?
git log --all --format='%an <%ae> | %cn <%ce>' | sort -u

# Any hidden "Co-Authored-By" credits?
git log --all --format='%b' | grep -i 'co-authored-by'

# How many commits per person?
git shortlog -sne --all
```

Then make a safety backup you can roll back to:

```bash
git branch backup-before-cleanup dev
git branch backup-before-cleanup-main main
```

*(Delete these once everything is pushed and looks right — see the end.)*

---

## Step 1 — Rename the old author to the new one

This finds every commit made by the old identity and re-stamps it with the new
one. **Replace the four values** at the top with your own:

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
# 👇 change these four lines
OLD_EMAIL="old-account@example.com"
OLD_NAME="old-username"
NEW_NAME="your-username"
NEW_EMAIL="your-email@example.com"

if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ] || [ "$GIT_AUTHOR_NAME" = "$OLD_NAME" ]; then
    export GIT_AUTHOR_NAME="$NEW_NAME"
    export GIT_AUTHOR_EMAIL="$NEW_EMAIL"
fi
if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ] || [ "$GIT_COMMITTER_NAME" = "$OLD_NAME" ]; then
    export GIT_COMMITTER_NAME="$NEW_NAME"
    export GIT_COMMITTER_EMAIL="$NEW_EMAIL"
fi
' -- dev main
```

- `-- dev main` = clean these two branches. They usually share all history, so
  this covers everything. To clean **every** branch and tag instead, use `-- --all`.
- Have more than one old account? Run this step again with the next account's values.

---

## Step 2 — Remove the "Co-Authored-By" credits

This deletes the co-author lines from every commit message (the rest of the
message is untouched):

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter '
sed "/^Co-Authored-By:/Id"
' -- dev main
```

*(Want to remove only one specific co-author and keep others? Make the pattern
more specific, e.g. `sed "/Co-Authored-By:.*anthropic/Id"`.)*

---

## Step 3 — Tidy up the leftovers

`filter-branch` keeps a hidden backup of the old commits. Clear it so the old
identities are really gone from your local copy:

```bash
git for-each-ref --format='%(refname)' refs/original/ | while read r; do git update-ref -d "$r"; done
git reflog expire --expire=now --all
git gc --prune=now
```

---

## Step 4 — Double-check it worked

Check the **branches themselves** (not `--all`, which also shows the not-yet-pushed
remote copy):

```bash
git shortlog -sne dev main          # should list only YOU
git log dev main --format='%an <%ae>' | sort -u          # should be just your name
git log dev main --format='%b' | grep -i 'co-authored-by'  # should print nothing
```

If those look right, you're ready to publish.

---

## Step 5 — Publish (force-push)

```bash
git push --force-with-lease origin dev main
```

- `--force-with-lease` is the *safe* force-push: it refuses if someone else
  pushed in the meantime.
- If it asks for a username/password, your terminal isn't logged in to GitHub —
  see "It asks for a password" below.

After it succeeds, the old identities are gone from GitHub. The contributions
graph can take a little while to catch up.

Finally, remove the safety backups from Step 0:

```bash
git branch -D backup-before-cleanup backup-before-cleanup-main
```

---

## Copy-paste version (all steps)

Replace the four values, then run top to bottom:

```bash
OLD_EMAIL="old-account@example.com"; OLD_NAME="old-username"
NEW_NAME="your-username"; NEW_EMAIL="your-email@example.com"

git branch backup-before-cleanup dev

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter "
if [ \"\$GIT_AUTHOR_EMAIL\" = \"$OLD_EMAIL\" ] || [ \"\$GIT_AUTHOR_NAME\" = \"$OLD_NAME\" ]; then export GIT_AUTHOR_NAME=\"$NEW_NAME\"; export GIT_AUTHOR_EMAIL=\"$NEW_EMAIL\"; fi
if [ \"\$GIT_COMMITTER_EMAIL\" = \"$OLD_EMAIL\" ] || [ \"\$GIT_COMMITTER_NAME\" = \"$OLD_NAME\" ]; then export GIT_COMMITTER_NAME=\"$NEW_NAME\"; export GIT_COMMITTER_EMAIL=\"$NEW_EMAIL\"; fi
" -- dev main

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter 'sed "/^Co-Authored-By:/Id"' -- dev main

git for-each-ref --format='%(refname)' refs/original/ | while read r; do git update-ref -d "$r"; done
git reflog expire --expire=now --all && git gc --prune=now

git push --force-with-lease origin dev main
```

---

## Troubleshooting

**"It still shows the old name after I run the checks."**
You probably ran `git log --all`, which also reads `origin/...` (the copy on
GitHub that you haven't force-pushed yet). Check `git log dev main` instead, or
just finish Step 5.

**"`git push` asks for a Username/Password and won't continue."**
Your terminal isn't authenticated with GitHub. Easiest fix with the GitHub CLI:

```bash
gh auth login          # follow the prompts (browser or token)
git push --force-with-lease origin dev main
```

Or create a Personal Access Token (GitHub → Settings → Developer settings →
Tokens) and use it as the password when prompted.

**"The contributions graph still shows them."**
Give it time — GitHub recomputes it in the background. Also make sure the email
you removed wasn't *also* present as a verified email on the account you kept.

---

## Stop it from happening again

Set the right identity for new commits in this repo:

```bash
git config user.name  "your-username"
git config user.email "your-email@example.com"
```

And don't add `Co-Authored-By:` lines to commit messages if you want a
single-contributor history.

---

### A note on the tool used here

This guide uses `git filter-branch` because it comes with Git — nothing to
install. There's a newer, faster tool called
[`git-filter-repo`](https://github.com/newren/git-filter-repo) that does the same
job more quickly; if you have it installed, it's worth using for very large repos.
