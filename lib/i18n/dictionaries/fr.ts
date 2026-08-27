/**
 * Reference dictionary (French) - the source of truth for every translatable
 * string in the app. `Dictionary` (see lib/i18n/locale.ts) is inferred from
 * this object's shape, so any key missing from dictionaries/en.ts is a
 * TypeScript compile error rather than a silent runtime fallback.
 *
 * Scope: this covers the human-facing web app only (pages, components,
 * server action error messages, Zod validation messages, transactional
 * emails). It deliberately does NOT cover lib/mcp/tools.ts or
 * app/api/[transport]/route.ts - those are MCP protocol text consumed by an
 * LLM (Claude), not UI shown to a human, and are out of scope by design.
 *
 * Structure: grouped by page/feature. Parameterized strings are plain
 * functions (e.g. `(email: string) => \`...\``) rather than a template
 * mini-language, since every consumer here is TypeScript already.
 */
export const fr = {
  meta: {
    title: "Mail MCP",
    description: "Serveur MCP pour piloter une boîte mail IMAP/SMTP depuis Claude",
  },

  common: {
    emailLabel: "Email",
    passwordLabel: "Mot de passe",
    login: "Se connecter",
    cancel: "Annuler",
    create: "Créer",
    add: "Ajouter",
    share: "Partager",
    save: "Enregistrer",
    edit: "Modifier",
  },

  languageSwitcher: {
    fr: "FR",
    en: "EN",
  },

  errors: {
    rateLimited: "Trop de tentatives, réessayez plus tard.",
    invalidForm: "Formulaire invalide",
    unknownError: "erreur inconnue",
    mailboxNotFound: "Boîte introuvable.",
  },

  auth: {
    login: {
      tagline: "Piloter votre boîte mail depuis Claude",
      submitPending: "Connexion...",
      orDivider: "ou",
      continueWithGoogle: "Continuer avec Google",
      continueWithGithub: "Continuer avec GitHub",
      errors: {
        oauthOnly: "Ce compte se connecte via Google ou GitHub, pas avec un mot de passe.",
        unverifiedEmail: "Confirmez d'abord votre adresse email (lien envoyé à l'inscription).",
        invalidCredentials: "Identifiant ou mot de passe incorrect.",
      },
    },
    signup: {
      title: "Créer votre compte",
      missingInviteLink: "Lien d'invitation manquant.",
      invalidOrExpiredInvite: "Cette invitation est invalide ou a expiré.",
      submitPending: "Création...",
      submit: "Créer mon compte",
      verifyingMessage:
        "Compte créé : un email de confirmation vient de vous être envoyé. Cliquez sur le lien qu'il contient pour activer votre compte, puis connectez-vous.",
      errors: {
        invalidOrExpiredInvite: "Invitation invalide ou expirée.",
        emailTaken: "Cet email est déjà utilisé par un autre compte.",
        verificationEmailFailed:
          "Compte créé, mais l'envoi de l'email de vérification a échoué (configuration serveur manquante). Contactez l'administrateur.",
      },
    },
    setup: {
      passwordLabel: "Mot de passe (IMAP/SMTP)",
      serverSettingsSummary: "Paramètres serveur (par défaut : OVH)",
      imapHostLabel: "Hôte IMAP",
      imapPortLabel: "Port IMAP",
      imapSecureLabel: "IMAP en SSL",
      smtpHostLabel: "Hôte SMTP",
      smtpPortLabel: "Port SMTP",
      smtpSecureLabel: "SMTP en SSL",
      submitPending: "Vérification de la connexion...",
      submitAdd: "Ajouter cette boîte",
      submitUpdate: "Mettre à jour",
      updateSuccess: "Identifiants mis à jour.",
    },
    verifyEmail: {
      title: "Confirmation d'email",
      invalidLink: "Lien de confirmation invalide.",
      confirmed: "Votre email est confirmé. Vous pouvez vous connecter.",
      errors: {
        invalidOrExpiredLink: "Lien de vérification invalide ou expiré.",
      },
    },
    logout: {
      label: "Se déconnecter",
    },
  },

  orgInvite: {
    title: "Invitation à une organisation",
    missingLink: "Lien d'invitation manquant.",
    invalidOrExpired: "Cette invitation est invalide ou a expiré.",
    mismatch: (inviteEmail: string, sessionEmail: string) =>
      `Cette invitation est destinée à ${inviteEmail}, mais vous êtes connecté en tant que ${sessionEmail}.`,
    noAccountYet: (email: string, orgName: string) =>
      `${email} n'a pas encore de compte Mail MCP sur cette instance. Demandez d'abord une invitation d'accès à la plateforme, créez le compte, puis revenez sur ce lien pour rejoindre "${orgName}".`,
    loginPrompt: {
      prefix: "Connectez-vous avec",
      suffix: (orgName: string) => `pour rejoindre "${orgName}".`,
    },
    joinPrompt: {
      prefix: "Rejoindre l'organisation",
      suffix: "?",
    },
    acceptButton: "Rejoindre l'organisation",
    acceptPending: "Acceptation...",
    errors: {
      invalidOrExpired: "Invitation invalide ou expirée.",
      wrongAccount: (inviteEmail: string, userEmail: string) =>
        `Cette invitation est destinée à ${inviteEmail}, pas à ${userEmail}.`,
      acceptFailed: "Impossible d'accepter cette invitation.",
    },
  },

  oauth: {
    title: "Autorisation d'accès",
    invalidRequest: "Requête d'autorisation invalide.",
    unsupportedPkce: (method: string) => `Méthode PKCE non supportée (${method}) - seul S256 est accepté.`,
    unknownClientOrRedirect: "Application inconnue ou URL de redirection non autorisée.",
    unknownApp: "Application inconnue",
    consent: {
      middle: "demande à accéder, en lecture et en envoi, à toutes les boîtes mail accessibles depuis votre compte",
      suffix: "(boîtes propres et partagées via une organisation) via ce serveur MCP.",
    },
    deny: "Refuser",
    approve: "Autoriser",
    approvePending: "Autorisation...",
    errors: {
      invalidClient: "Client OAuth invalide",
    },
  },

  settings: {
    connectedAs: (email: string) => `Connecté en tant que ${email}`,

    nav: {
      mailboxes: "Boîtes mail",
      organizations: "Organisations",
      apps: "Applications",
    },

    mailboxes: {
      title: "Boîtes mail",
      description: "Identifiants IMAP/SMTP de vos boîtes. Toute modification est testée avant d'être enregistrée.",
      intro:
        "Boîtes IMAP/SMTP attachées à votre compte. Celle marquée \"par défaut\" est utilisée quand un appel MCP ne précise pas de boîte.",
      noMailboxes: "Aucune boîte mail attachée pour l'instant.",
      defaultBadge: "par défaut",
      setDefaultButton: "Définir par défaut",
      deleteButton: "Supprimer",
      confirmDeletePrefix: "Supprimer la boîte ",
      confirmDeleteSuffix: " ? Tout accès partagé via une organisation sera retiré.",
      addButton: "Ajouter une boîte",
      testButton: "Tester la connexion IMAP",
      testPending: "Test en cours...",
      testSuccessPrefix: "Connexion OK. Dossiers : ",
      defaultPicker: {
        label: "Boîte par défaut (utilisée quand un appel MCP n'en précise pas)",
        saveButton: "Enregistrer",
        saveSuccess: "Boîte par défaut mise à jour.",
      },
      share: {
        title: "Partager cette boîte dans une organisation",
        success: "Boîte partagée.",
      },
      errors: {
        notAccessible: "Cette boîte n'est pas accessible depuis ce compte.",
        emailAlreadyAttached: "Vous avez déjà attaché cette adresse.",
      },
    },

    organizations: {
      title: "Organisations",
      description:
        "Partagez des boîtes mail avec d'autres comptes, avec un contrôle d'accès granulaire (par boîte ou par groupe de boîtes).",
      intro: {
        part1: "Une organisation permet de partager des boîtes mail avec d'autres comptes : un",
        part2: "a accès à tout ce qui y est partagé, un",
        part3: "seulement à ce qui lui est explicitement accordé (boîte par boîte, ou via un groupe).",
      },
      createButton: "Créer une organisation",
      namePlaceholder: "Nom de l'organisation",
      confirmRemoveMember: "Retirer ce membre de l'organisation ?",
      confirmCancelInvite: "Annuler cette invitation ? Les accès déjà accordés seront perdus.",
      confirmUnshare: "Retirer cette boîte de l'organisation ?",
      shareSuccess: "Boîte partagée.",
      membersTitle: "Membres",
      emailPlaceholder: "email@exemple.com",
      inviteButton: "Inviter",
      pendingBadge: "en attente",
      pendingSuffix: "(en attente)",
      ownerNotice:
        "Vous êtes propriétaire : accès complet automatique à toutes les boîtes partagées ci-dessous, sans avoir besoin d'un accès explicite.",
      yourAccessTitle: "Vos accès",
      noAccessYet: "Aucun accès ne vous a été accordé pour l'instant dans cette organisation.",
      groupLabelPrefix: "Groupe « ",
      groupLabelSuffix: " »",
      groupEmpty: "aucune boîte pour l'instant",
      sharedMailboxesTitle: "Boîtes partagées",
      noSharedMailboxes: "Aucune boîte partagée pour l'instant.",
      ownerLabel: "propriétaire",
      groupsTitle: "Groupes de boîtes",
      groupNamePlaceholder: "Nom du groupe",
      noGroups: "Aucun groupe pour l'instant.",
      renameGroupTooltip: "Renommer le groupe",
      deleteGroupTooltip: "Supprimer le groupe",
      confirmDeleteGroup: "Supprimer ce groupe ? Les accès accordés via ce groupe seront perdus.",
      grantsTitle: "Accès accordés",
      noGrants: "Aucun accès accordé pour l'instant.",
      groupRefPrefix: 'groupe "',
      groupRefSuffix: '"',
      mailboxOptionPrefix: "Boîte",
      groupOptionPrefix: "Groupe",
      grantButton: "Accorder",
      transferOwnershipTitle: "Transférer la propriété à...",
      transferButton: "Transférer",
      confirmTransferOwnershipPrefix: "Transférer la propriété de l'organisation à ",
      confirmTransferOwnershipSuffix:
        " ? Vous redeviendrez un membre normal et perdrez l'accès complet automatique de propriétaire.",
      lastOwnerBadge: "dernier propriétaire",
      lastOwnerRemoveTooltip: "Transférez d'abord la propriété de l'organisation avant de vous retirer.",
      errors: {
        notMember: "Vous ne faites pas partie de cette organisation.",
        ownersOnly: "Réservé aux propriétaires de l'organisation.",
        notFound: "Organisation introuvable.",
        alreadyMember: "Cette personne fait déjà partie de l'organisation.",
        inviteEmailFailed:
          "Invitation créée, mais l'envoi de l'email a échoué (configuration serveur manquante). Partagez le lien manuellement si besoin.",
        inviteNotFound: "Invitation introuvable.",
        inviteAlreadyAccepted: "Cette invitation a déjà été acceptée - gérez l'accès depuis la liste des membres.",
        memberNotFound: "Membre introuvable.",
        cannotRemoveLastOwner: "Impossible de retirer le dernier propriétaire de l'organisation.",
        notMailboxOwner: "Vous ne possédez pas cette boîte mail.",
        alreadySharedInOrg: "Cette boîte est déjà partagée dans cette organisation.",
        ownerOrOrgOwnerOnly: "Réservé au propriétaire de la boîte ou de l'organisation.",
        groupNotFound: "Groupe introuvable.",
        mailboxNotSharedInOrg: "Cette boîte n'est pas partagée dans cette organisation.",
        alreadyInGroup: "Cette boîte est déjà dans ce groupe.",
        memberAlreadyOwner: "Ce membre est déjà propriétaire : accès complet automatique.",
        groupNotInOrg: "Ce groupe n'appartient pas à cette organisation.",
        grantAlreadyExists: "Cet accès est déjà accordé.",
        grantNotFound: "Accès introuvable.",
        transferTargetMustBeMember:
          "La propriété ne peut être transférée qu'à un membre déjà inscrit (ni un propriétaire, ni une invitation en attente).",
      },
    },

    mcpToken: {
      title: "Jeton MCP",
      intro:
        "Ce jeton donne accès à toutes vos boîtes accessibles (les vôtres et celles partagées via une organisation), quel que soit le connecteur qui l'utilise. Un seul jeton par compte.",
      urlLabel: "URL du serveur MCP",
      copied: "Copié.",
      regenerateButton: "Régénérer le token",
      regeneratePending: "Régénération...",
      confirmRegenerate:
        "Régénérer le token va invalider l'ancien : tout connecteur déjà configuré (Claude...) devra être mis à jour avec le nouveau. Continuer ?",
    },

    oauthClients: {
      title: "Applications connectées (OAuth)",
      description:
        "Applications ayant obtenu l'accès via l'écran d'autorisation - à toutes vos boîtes accessibles (propres et partagées). Révoquer coupe leur accès immédiatement.",
      empty: "Aucune application connectée via OAuth pour le moment.",
      connectedOnPrefix: "Connectée le ",
      lastUsedOnPrefix: ", dernier accès le ",
      revokeButton: "Révoquer",
      revokePending: "Révocation...",
      confirmRevoke:
        "Révoquer l'accès de cette application ? Elle devra repasser par l'écran d'autorisation pour se reconnecter.",
    },
  },

  mail: {
    authFailed:
      "Authentification refusée par le serveur mail : le mot de passe enregistré n'est probablement plus valide (changé côté OVH ?). Va sur Réglages pour le mettre à jour.",
    connectionError: "Erreur de connexion à la boîte mail.",
    imapConnectionFailed: (msg: string) => `Connexion IMAP impossible : ${msg}`,
    smtpConnectionFailed: (msg: string) => `Connexion SMTP impossible : ${msg}`,
  },

  email: {
    verify: {
      subject: "Confirmez votre adresse email - Mail MCP",
      body: (verifyUrl: string) =>
        `Bienvenue sur Mail MCP.\n\nConfirmez votre adresse email pour activer votre compte :\n${verifyUrl}\n\nCe lien expire dans 24h.`,
    },
    orgInvite: {
      subject: (orgName: string) => `Invitation à rejoindre "${orgName}" - Mail MCP`,
      body: (inviterEmail: string, orgName: string, acceptUrl: string) =>
        `${inviterEmail} vous invite à rejoindre l'organisation "${orgName}" sur Mail MCP.\n\nAcceptez l'invitation : ${acceptUrl}\n\nCe lien expire dans 7 jours. Si vous n'avez pas encore de compte Mail MCP, vous devez d'abord en créer un (invitation séparée pour la plateforme), puis revenir sur ce lien.`,
    },
  },

  validation: {
    emailInvalid: "Email invalide",
    passwordRequired: "Le mot de passe est requis",
    passwordMinLength: "8 caractères minimum",
    imapHostRequired: "Hôte IMAP requis",
    smtpHostRequired: "Hôte SMTP requis",
    nameRequired: "Nom requis",
    inviteMissing: "Invitation manquante",
  },
};
