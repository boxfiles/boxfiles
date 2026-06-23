---
name: gh-repo-setup-cli
description: Standardizes GitHub repository settings using the local .github/tasks/repo-setup task, including merge policy, Actions workflow permissions for PR automation, and default branch protection.
---

# GH Repo Setup CLI

## Overview
Use this skill to bootstrap or standardize a GitHub repository.

Primary path: run the repository task script in this repo:
- `.github/tasks/repo-setup`

This is the canonical, repeatable setup path and SHOULD be preferred over manually retyping multiple `gh` commands.

## When to Use
- New repository bootstrap from this template.
- Existing repository policy drift (merge settings, Actions permissions, PR automation).
- Any request to “set repo defaults” or “standardize GitHub settings”.

Do not use when you lack admin permissions to the target repository.

## Required Policy Outcome
- Pull requests required on default branch.
- Auto-delete branch on merge enabled.
- Only squash merges enabled.
- Squash commit message mode set to `PR_TITLE` + `PR_BODY`.
- Actions enabled for repo.
- Workflow token default permissions set to `write`.
- Workflows allowed to create/close/approve pull requests.

## Workflow
1. **Preflight**
   ```bash
   gh auth status
   gh repo view OWNER/REPO --json name,defaultBranchRef
   ```

2. **Create repo (if needed)**
   ```bash
   gh repo create OWNER/REPO --private --clone=false --confirm
   ```

3. **Apply baseline repo + Actions settings via task script (preferred)**
   ```bash
   .github/tasks/repo-setup OWNER/REPO
   ```

   Notes:
   - If `OWNER/REPO` is omitted, script resolves current repo via `gh repo view`.
   - Script applies:
     - `gh repo edit ...` merge/wiki/update-branch flags
     - `PUT /repos/{owner}/{repo}/actions/permissions`
     - `PUT /repos/{owner}/{repo}/actions/permissions/workflow`
   - Script prints verification snapshots after apply.

4. **Set squash commit defaults (API fallback path)**
   ```bash
   gh api -X PATCH repos/OWNER/REPO \
     -f squash_merge_commit_title=PR_TITLE \
     -f squash_merge_commit_message=PR_BODY
   ```

5. **Require PRs on default branch (safe apply)**
   > `PUT /branches/{branch}/protection` is full-replacement style. Fetch current settings, merge intended changes, then apply.

   ```bash
   BRANCH=$(gh repo view OWNER/REPO --json defaultBranchRef -q '.defaultBranchRef.name')
   PROTECTION_ENDPOINT="repos/OWNER/REPO/branches/$BRANCH/protection"

   if gh api "$PROTECTION_ENDPOINT" > /tmp/current-protection.json 2>/tmp/protection-fetch.err; then
     echo "Existing protection found"
   else
     if grep -q "404" /tmp/protection-fetch.err; then
       echo "No existing protection (fresh setup)"
       printf '{}\n' > /tmp/current-protection.json
     else
       echo "Failed to fetch existing protection; aborting to avoid unsafe overwrite." >&2
       cat /tmp/protection-fetch.err >&2
       exit 1
     fi
   fi

   cat > /tmp/intended-protection.json <<'JSON'
   {
     "required_status_checks": null,
     "enforce_admins": true,
     "required_pull_request_reviews": {
       "dismiss_stale_reviews": true,
       "required_approving_review_count": 1,
       "require_code_owner_reviews": false
     },
     "restrictions": null,
     "required_linear_history": true,
     "allow_force_pushes": false,
     "allow_deletions": false,
     "block_creations": false,
     "required_conversation_resolution": true,
     "lock_branch": false,
     "allow_fork_syncing": true
   }
   JSON

   jq -s '.[0] * .[1]' \
     /tmp/current-protection.json \
     /tmp/intended-protection.json > /tmp/merged-protection.json

   gh api -X PUT "$PROTECTION_ENDPOINT" \
     -H "Accept: application/vnd.github+json" \
     --input /tmp/merged-protection.json
   ```

6. **Verify**
   ```bash
   gh repo view OWNER/REPO --json deleteBranchOnMerge,mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed
   gh api repos/OWNER/REPO/actions/permissions
   gh api repos/OWNER/REPO/actions/permissions/workflow
   gh api repos/OWNER/REPO/branches/$BRANCH/protection
   ```

7. **Workflow-level permission reminder (required for runtime success)**
   Even with repo-level settings, affected workflow files MUST include permissions needed to mutate PRs:
   ```yaml
   permissions:
     contents: write
     pull-requests: write
   ```

## Caveats
- Org rulesets MAY override repo-level settings.
- Do not claim success without command output proving remote state.
- If using protection APIs, avoid blind overwrite on existing repos.

## Quick Triage
- `403/404` from protection/actions endpoints: verify admin rights and repo path.
- PR automation still fails: check workflow `permissions:` block and branch protection/rulesets.
- Settings revert: inspect org-level rulesets or policy-as-code automations.
