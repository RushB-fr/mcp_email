import type { Dictionary } from "@/lib/i18n/locale";

/**
 * English translation. Typed explicitly as `Dictionary` (inferred from
 * dictionaries/fr.ts) so that a key missing here - or shaped differently -
 * is a TypeScript compile error, never a silent fallback to French at
 * runtime.
 */
export const en: Dictionary = {
  meta: {
    title: "Mail MCP",
    description: "MCP server to drive an IMAP/SMTP mailbox from Claude",
  },

  common: {
    emailLabel: "Email",
    passwordLabel: "Password",
    login: "Log in",
    cancel: "Cancel",
    create: "Create",
    add: "Add",
    share: "Share",
    save: "Save",
    edit: "Edit",
  },

  languageSwitcher: {
    fr: "FR",
    en: "EN",
  },

  errors: {
    rateLimited: "Too many attempts, try again later.",
    invalidForm: "Invalid form",
    unknownError: "unknown error",
    mailboxNotFound: "Mailbox not found.",
  },

  auth: {
    login: {
      tagline: "Drive your mailbox from Claude",
      submitPending: "Logging in...",
      orDivider: "or",
      continueWithGoogle: "Continue with Google",
      continueWithGithub: "Continue with GitHub",
      errors: {
        oauthOnly: "This account signs in via Google or GitHub, not with a password.",
        unverifiedEmail: "Confirm your email address first (link sent at signup).",
        invalidCredentials: "Incorrect email or password.",
      },
    },
    signup: {
      title: "Create your account",
      missingInviteLink: "Missing invite link.",
      invalidOrExpiredInvite: "This invitation is invalid or has expired.",
      submitPending: "Creating...",
      submit: "Create my account",
      verifyingMessage:
        "Account created: a confirmation email was just sent to you. Click the link it contains to activate your account, then log in.",
      errors: {
        invalidOrExpiredInvite: "Invalid or expired invitation.",
        emailTaken: "This email is already used by another account.",
        verificationEmailFailed:
          "Account created, but sending the verification email failed (missing server configuration). Contact the administrator.",
      },
    },
    setup: {
      passwordLabel: "Password (IMAP/SMTP)",
      serverSettingsSummary: "Server settings (IMAP/SMTP)",
      imapHostLabel: "IMAP host",
      imapPortLabel: "IMAP port",
      imapSecureLabel: "IMAP over SSL",
      smtpHostLabel: "SMTP host",
      smtpPortLabel: "SMTP port",
      smtpSecureLabel: "SMTP over SSL",
      submitPending: "Checking connection...",
      submitAdd: "Add this mailbox",
      submitUpdate: "Update",
      updateSuccess: "Credentials updated.",
    },
    verifyEmail: {
      title: "Email confirmation",
      invalidLink: "Invalid confirmation link.",
      confirmed: "Your email is confirmed. You can now log in.",
      errors: {
        invalidOrExpiredLink: "Invalid or expired verification link.",
      },
    },
    logout: {
      label: "Log out",
    },
  },

  orgInvite: {
    title: "Organization invitation",
    missingLink: "Missing invite link.",
    invalidOrExpired: "This invitation is invalid or has expired.",
    mismatch: (inviteEmail: string, sessionEmail: string) =>
      `This invitation is for ${inviteEmail}, but you're logged in as ${sessionEmail}.`,
    noAccountYet: (email: string, orgName: string) =>
      `${email} doesn't have a Mail MCP account on this instance yet. Request a platform access invite first, create the account, then come back to this link to join "${orgName}".`,
    loginPrompt: {
      prefix: "Log in as",
      suffix: (orgName: string) => `to join "${orgName}".`,
    },
    joinPrompt: {
      prefix: "Join organization",
      suffix: "?",
    },
    acceptButton: "Join organization",
    acceptPending: "Joining...",
    errors: {
      invalidOrExpired: "Invalid or expired invitation.",
      wrongAccount: (inviteEmail: string, userEmail: string) =>
        `This invitation is for ${inviteEmail}, not ${userEmail}.`,
      acceptFailed: "Could not accept this invitation.",
    },
  },

  oauth: {
    title: "Access authorization",
    invalidRequest: "Invalid authorization request.",
    unsupportedPkce: (method: string) => `Unsupported PKCE method (${method}) - only S256 is accepted.`,
    unknownClientOrRedirect: "Unknown application or unauthorized redirect URL.",
    unknownApp: "Unknown application",
    consent: {
      middle: "is requesting read and send access to every mailbox accessible from your account",
      suffix: "(your own and any shared via an organization) through this MCP server.",
    },
    deny: "Deny",
    approve: "Authorize",
    approvePending: "Authorizing...",
    errors: {
      invalidClient: "Invalid OAuth client",
    },
  },

  settings: {
    connectedAs: (email: string) => `Logged in as ${email}`,

    nav: {
      mailboxes: "Mailboxes",
      organizations: "Organizations",
      apps: "Applications",
    },

    mailboxes: {
      title: "Mailboxes",
      description: "IMAP/SMTP credentials for your mailboxes. Any change is tested before being saved.",
      intro:
        "IMAP/SMTP mailboxes attached to your account. The one marked \"default\" is used when an MCP call doesn't specify a mailbox.",
      noMailboxes: "No mailbox attached yet.",
      defaultBadge: "default",
      setDefaultButton: "Set as default",
      deleteButton: "Delete",
      confirmDeletePrefix: "Delete mailbox ",
      confirmDeleteSuffix: "? Any access shared via an organization will be removed.",
      addButton: "Add a mailbox",
      testButton: "Test IMAP connection",
      testPending: "Testing...",
      testSuccessPrefix: "Connection OK. Folders: ",
      defaultPicker: {
        label: "Default mailbox (used when an MCP call doesn't specify one)",
        saveButton: "Save",
        saveSuccess: "Default mailbox updated.",
      },
      share: {
        title: "Share this mailbox in an organization",
        success: "Mailbox shared.",
      },
      errors: {
        notAccessible: "This mailbox isn't accessible from this account.",
        emailAlreadyAttached: "You've already attached this address.",
      },
    },

    organizations: {
      title: "Organizations",
      description:
        "Share mailboxes with other accounts, with granular access control (per mailbox or per mailbox group).",
      intro: {
        part1: "An organization lets you share mailboxes with other accounts: an",
        part2: "has access to everything shared in it, a",
        part3: "only to what's explicitly granted to them (mailbox by mailbox, or via a group).",
      },
      createButton: "Create an organization",
      namePlaceholder: "Organization name",
      confirmRemoveMember: "Remove this member from the organization?",
      confirmCancelInvite: "Cancel this invitation? Any access already granted will be lost.",
      confirmUnshare: "Remove this mailbox from the organization?",
      shareSuccess: "Mailbox shared.",
      membersTitle: "Members",
      emailPlaceholder: "email@example.com",
      inviteButton: "Invite",
      pendingBadge: "pending",
      pendingSuffix: "(pending)",
      ownerNotice:
        "You're an owner: automatic full access to every mailbox shared below, no explicit access needed.",
      yourAccessTitle: "Your access",
      noAccessYet: "No access has been granted to you yet in this organization.",
      groupLabelPrefix: 'Group "',
      groupLabelSuffix: '"',
      groupEmpty: "no mailbox yet",
      sharedMailboxesTitle: "Shared mailboxes",
      noSharedMailboxes: "No mailbox shared yet.",
      ownerLabel: "owner",
      groupsTitle: "Mailbox groups",
      groupNamePlaceholder: "Group name",
      noGroups: "No group yet.",
      renameGroupTooltip: "Rename group",
      deleteGroupTooltip: "Delete group",
      confirmDeleteGroup: "Delete this group? Access granted through this group will be lost.",
      grantsTitle: "Granted access",
      noGrants: "No access granted yet.",
      groupRefPrefix: 'group "',
      groupRefSuffix: '"',
      mailboxOptionPrefix: "Mailbox",
      groupOptionPrefix: "Group",
      grantButton: "Grant",
      transferOwnershipTitle: "Transfer ownership to...",
      transferButton: "Transfer",
      confirmTransferOwnershipPrefix: "Transfer organization ownership to ",
      confirmTransferOwnershipSuffix:
        "? You'll become a regular member again and lose the owner's automatic full access.",
      lastOwnerBadge: "last owner",
      lastOwnerRemoveTooltip: "Transfer ownership of the organization first before removing yourself.",
      errors: {
        notMember: "You're not part of this organization.",
        ownersOnly: "Reserved for organization owners.",
        notFound: "Organization not found.",
        alreadyMember: "This person is already part of the organization.",
        inviteEmailFailed:
          "Invitation created, but sending the email failed (missing server configuration). Share the link manually if needed.",
        inviteNotFound: "Invitation not found.",
        inviteAlreadyAccepted: "This invitation has already been accepted - manage access from the member list.",
        memberNotFound: "Member not found.",
        cannotRemoveLastOwner: "Cannot remove the last owner of the organization.",
        notMailboxOwner: "You don't own this mailbox.",
        alreadySharedInOrg: "This mailbox is already shared in this organization.",
        ownerOrOrgOwnerOnly: "Reserved for the mailbox owner or an organization owner.",
        groupNotFound: "Group not found.",
        mailboxNotSharedInOrg: "This mailbox isn't shared in this organization.",
        alreadyInGroup: "This mailbox is already in this group.",
        memberAlreadyOwner: "This member is already an owner: automatic full access.",
        groupNotInOrg: "This group doesn't belong to this organization.",
        grantAlreadyExists: "This access has already been granted.",
        grantNotFound: "Access not found.",
        transferTargetMustBeMember:
          "Ownership can only be transferred to an already-enrolled member (not an owner, not a pending invite).",
      },
    },

    mcpToken: {
      title: "MCP token",
      intro:
        "This token grants access to all of your accessible mailboxes (your own and any shared via an organization), regardless of which connector uses it. One token per account.",
      urlLabel: "MCP server URL",
      copied: "Copied.",
      regenerateButton: "Regenerate token",
      regeneratePending: "Regenerating...",
      confirmRegenerate:
        "Regenerating the token will invalidate the old one: any connector already configured (Claude...) will need to be updated with the new one. Continue?",
    },

    oauthClients: {
      title: "Connected applications (OAuth)",
      description:
        "Applications that obtained access through the authorization screen - to all of your accessible mailboxes (own and shared). Revoking cuts their access immediately.",
      empty: "No application connected via OAuth yet.",
      connectedOnPrefix: "Connected on ",
      lastUsedOnPrefix: ", last used on ",
      revokeButton: "Revoke",
      revokePending: "Revoking...",
      confirmRevoke:
        "Revoke this application's access? It will have to go through the authorization screen again to reconnect.",
    },
  },

  mail: {
    authFailed:
      "Authentication rejected by the mail server: the stored password is probably no longer valid (changed with your mail provider?). Go to Settings to update it.",
    connectionError: "Error connecting to the mailbox.",
    imapConnectionFailed: (msg: string) => `IMAP connection failed: ${msg}`,
    smtpConnectionFailed: (msg: string) => `SMTP connection failed: ${msg}`,
  },

  email: {
    verify: {
      subject: "Confirm your email address - Mail MCP",
      body: (verifyUrl: string) =>
        `Welcome to Mail MCP.\n\nConfirm your email address to activate your account:\n${verifyUrl}\n\nThis link expires in 24h.`,
    },
    orgInvite: {
      subject: (orgName: string) => `Invitation to join "${orgName}" - Mail MCP`,
      body: (inviterEmail: string, orgName: string, acceptUrl: string) =>
        `${inviterEmail} is inviting you to join the organization "${orgName}" on Mail MCP.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in 7 days. If you don't have a Mail MCP account yet, you'll need to create one first (separate platform invite), then come back to this link.`,
    },
  },

  validation: {
    emailInvalid: "Invalid email",
    passwordRequired: "Password is required",
    passwordMinLength: "8 characters minimum",
    imapHostRequired: "IMAP host required",
    smtpHostRequired: "SMTP host required",
    nameRequired: "Name required",
    inviteMissing: "Missing invitation",
  },
};
